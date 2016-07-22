'use strict';

var AWS = require('aws-sdk'),
    fs = require('fs'),
    // s3 = require('s3'),
    BPromise = require('bluebird'),
    _ = require('lodash'),
    shortid = require('shortid'),
    path = require('path'),
    fileMagik = require('file-magik'),
    mime = require('mime');

module.exports = Sync;

/**
 * Sync with the given config.
 * @param config                            {object}    The configuration options
 * @param config.s3Options                  {object}    S3 options
 * @param config.s3Options.accessKeyId      {string}    S3 access key id
 * @param config.s3Options.secretAccessKey  {string}    S3 secret access key
 * @param config.s3Options.region           {string}    S3 region
 * @param config.maxAsyncS3                 {number}    Maximum number of simultaneous requests this client will ever have open to S3.
 *                                                          Defaults to 20.
 * @param config.s3RetryCount               {number}    How many times to try an S3 operation before giving up. Default 3.
 * @param config.s3RetryDelay               {number}    How many milliseconds to wait before retrying an S3 operation. Default 1000.
 * @param config.multipartUploadThreshold   {number}    If a file is this many bytes or greater, it will be uploaded via a multipart
 *                                                          request. Default is 20MB. Minimum is 5MB. Maximum is 5GB
 * @param config.multipartUploadSize        {number}    When uploading via multipart, this is the part size. The minimum size is 5MB. The
 *                                                          maximum size is 5GB. Default is 15MB. Note that S3 has a maximum of 10000 parts
 *                                                          for a multipart upload, so if this value is too small, it will be ignored in
 *                                                          favor of the minimum necessary value required to upload the file.
 */
function Sync(config) {
	var self = this;
	this.config = _.merge(require('../config'), config);
	// console.log('config:', require('util').inspect(this.config, {depth: null, colors:true}));
	this.AWS = AWS;
	this.AWS.config.update(this.config.s3Options);
	this.S3 = new this.AWS.S3();
	this.cloudfront = new this.AWS.CloudFront({apiVersion: '2015-04-17'});

	if (this.config.ensureBucketWebsite) {
		this.bucketWebsiteUrl = this.config.s3Options.Bucket + '.s3-website-' + this.config.s3Options.region + '.amazonaws.com';
	}

	var params = {
		localDir: this.config.localDir,
		deleteRemoved: this.config.deleteRemoved,
		s3Params: {
			Bucket: this.config.s3Options.Bucket,
			Prefix: this.config.s3Options.Prefix || '',
			ACL: this.config.s3Options.ACL || 'public-read'
		}
	};

	return BPromise.coroutine(function*() {
		yield self.ensureBucketExists();
		self.bucketWebsite = self.config.ensureBucketWebsite ? yield self.ensureBucketWebsite() : null;

		if (self.config.ensureDistribution) {
			yield self.ensureDistributionExists();
		}

		var uploadedFiles = [];
		if (self.config.noUpload) {
			return {
				bucket: self.bucket,
				bucketWebsite: self.bucketWebsite,
				bucketWebsiteUrl: self.bucketWebsiteUrl,
				cloudfrontDistribution: self.cloudfrontDistribution,
				uploadedFiles: uploadedFiles
			};
		}

		// Get list of all distribution files
		let filePaths = fileMagik.get(params.localDir, {recursive: true, extension: null}),
		    started = 0;

		yield BPromise.map(filePaths, function (filePath) {
			started++;
			console.log(`Starting ${started}/${filePaths.length} uploads`);
			// Get relative path to localDir, normalize to forward slashes, remove initial forward slash if it exists
			let key = filePath.split(params.localDir)[1].replace(/\\/g, '/').replace(/^\//, '');

			// Create S3 Params for this specific object to upload
			let s3Params = Object.assign({}, params.s3Params, {
				Body: fs.createReadStream(filePath),
				ContentType: mime.lookup(filePath, 'application/octet-stream'),
				Key: (params.s3Params.Prefix ? params.s3Params.Prefix : '') + key
			});
			return new Promise(function(resolve, reject) {
				let managedUpload = self.S3.upload(s3Params, function(err, data) {
					if (err) return reject(err);
					resolve(data);
				});
				let lastLog;
				managedUpload.on('httpUploadProgress', function(data) {
					// Only log update status per file once per second
					if (!lastLog || (new Date() - lastLog > 350) || data.loaded == data.total) {
						// console.log('httpUploadProgress:', data);
						console.log(`\t${!data.total ? 'size not defined yet. Loaded:' + data.loaded :
							(Math.round(data.loaded/data.total*1000)/10 + '% (~' + Math.round(data.loaded/1028) + ' KB)')} -- ${key}`);
						lastLog = new Date();
					}
				});
			});
		}, {concurrency: self.config.s3Options.concurrency});

		if (self.config.ensureDistributionDefaultRootObj) {
			yield self.ensureDistributionDefaultRootObj();
		}

		if (self.cloudfrontDistribution) {
			let invalidationRes = yield self.cloudfrontFn('createInvalidation', {
				DistributionId: self.cloudfrontDistribution.Id,
				InvalidationBatch: {
					CallerReference: shortid.generate(),
					Paths: {
						Quantity: 1,
						Items:    ['/*']
					}
				}
			});

			console.log('InvalidationId:', invalidationRes.Id, 'Created:', invalidationRes.CreateTime, 'Status:', invalidationRes.status);

			var aliases = 'n/a';
			if (self.cloudfrontDistribution.Aliases && self.cloudfrontDistribution.Aliases.Quantity) {
				aliases = self.cloudfrontDistribution.Aliases.Items;
			}
			console.log('\nDistribution setting summary: ',
				/*'\nUploaded Files:\n', uploadedFiles.map(function(fileObj) {
				 return fileObj.fullKey
				 }),*/
				'\nDistribution URL:', self.bucketWebsiteUrl,
				'\nDistribution Id:', self.cloudfrontDistribution.Id,
				'\nDistribution website:', self.cloudfrontDistribution.DomainName,
				'\nAliases:\n', aliases);
		}

		if (!Sync.isModule) {
			process.exit(0);
		}


		return {
			bucket: self.bucket,
			bucketWebsite: self.bucketWebsite,
			bucketWebsiteUrl: self.bucketWebsiteUrl,
			cloudfrontDistribution: self.cloudfrontDistribution,
			uploadedFiles: filePaths
		};
	})().catch(function (err) {
		console.error('Error occurred during sync:', err);
		if (self.isModule) {
			return reject(err);
		}

		process.exit(1);
	});
}

Sync.prototype.ensureBucketExists = function () {
	var self = this;
	return this.s3Fn('listBuckets').then(function (response) {
		console.log('All buckets:\n', _.pluck(response.data.Buckets, 'Name'));
		if (_.find(response.data.Buckets, {Name: self.config.s3Options.Bucket})) {
			return response;
		}
		console.log('Bucket does not exist, creating it!');
		return self.s3Fn('createBucket', {
			Bucket: self.config.s3Options.Bucket,
			ACL: 'public-read'
		});
	});
};

Sync.prototype.ensureBucketWebsite = function () {
	var self = this,
	    config = self.config;
	return this.s3Fn('getBucketWebsite', {Bucket: config.s3Options.Bucket}).then(function (response) {
		return response.data;
	}).catch(function (err) {
		if (err.code === 'NoSuchWebsiteConfiguration') {
			console.log('No current bucket website!');
			return {};
		}
		throw err;
	}).then(function (bucketWebsite) {
		console.log('Current bucket website:\n', require('util').inspect(bucketWebsite, {depth: null, colors: true}));
		bucketWebsite = _.merge(
			bucketWebsite,
			config.bucketWebsite
		);

		if (config.DefaultRootObject) {
			bucketWebsite.IndexDocument.Suffix = config.DefaultRootObject;
			bucketWebsite.ErrorDocument.Key = config.DefaultRootObject;
		}

		if (bucketWebsite.RoutingRules && bucketWebsite.RoutingRules[0] && !bucketWebsite.RoutingRules[0].Redirect.HostName) {
			bucketWebsite.RoutingRules[0].Redirect.HostName = self.bucketWebsiteUrl;
		}

		bucketWebsite = {Bucket: self.config.s3Options.Bucket, WebsiteConfiguration: bucketWebsite};
		console.log('\nEnsure website settings -- PUT bucket website:\n',
			require('util').inspect(bucketWebsite.WebsiteConfiguration, {depth: null, colors: true}));
		// TODO: Set ContentMD5 in response for added security
		return self.s3Fn('putBucketWebsite', bucketWebsite);
	});
};

Sync.prototype.ensureDistributionExists = function () {
	var self = this;
	return self.cloudfrontFn('listDistributions', {}).then(function (response) {
		// console.log('response data:\n', require('util').inspect(response.data.Items, {depth:null, colors:true}));
		var distribution = self.getDistribution(response.data.Items);
		if (!distribution) {
			return self.createDistribution();
		}
		console.log('\nDistribution found, full current settings:\n', require('util').inspect(distribution, {depth: null, colors: true}));
		return distribution;
	}).then(function (cloudfrontDistribution) {
		console.log('\nDistribution setting summary: "', self.bucketWebsiteUrl,
			'" --\ndistributionId:', cloudfrontDistribution.Id, ', distribution website:', cloudfrontDistribution.DomainName);
		self.cloudfrontDistribution = cloudfrontDistribution;
	});
};

Sync.prototype.getDistribution = function getDistribution(distributions) {
	var self = this,
	    distribution = null;

	distributions.forEach(function (distro) {
		var exists = _.find(distro.Origins.Items, {
			DomainName: self.bucketWebsiteUrl
		});
		if (exists) {
			distribution = distro;
		}
	});
	return distribution;
};

Sync.prototype.createDistribution = function () {
	var self = this,
	    distributionConfig = self.config.cloudfrontDistribution.DistributionConfig;

	distributionConfig.CallerReference = shortid.generate();
	distributionConfig.DefaultCacheBehavior.TargetOriginId = 'Custom-' + self.bucketWebsiteUrl;
	distributionConfig.Origins.Items[0].DomainName = self.bucketWebsiteUrl;
	distributionConfig.Origins.Items[0].Id = 'Custom-' + self.bucketWebsiteUrl;
	// OriginPath must start with slash, and not have trailing slash
	distributionConfig.Origins.Items[0].OriginPath = !self.config.s3Options.Prefix ? '' : '/' +
	(self.config.s3Options.Prefix || '').replace(/^(\\|\/)/, '').replace(/(\\\/)*$/, '');
	console.log('Creating distribution with these settings:\n', require('util').inspect(self.config.cloudfrontDistribution,
		{depth: null, colors: true}));
	return self.cloudfrontFn('createDistribution', self.config.cloudfrontDistribution).then(function (response) {
		return response.data;
		//TODO: Set up a `waitFor` call to cloudfront to notify when distribution is ready? (Can take up to 25 minutes)
	});
};

Sync.prototype.ensureDistributionDefaultRootObj = function () {
	var self = this;
	return self.cloudfrontFn('getDistribution', {Id: self.cloudfrontDistribution.Id}).then(function (response) {
		var distribution = response.data,
		    bucketPrefix = self.config.s3Options.Prefix || '',
		    configDefaultRootObj = self.config.DefaultRootObject;

		if (distribution.DistributionConfig.Comment === null) {
			distribution.DistributionConfig.Comment = '';
		}
		if (distribution.DistributionConfig.Logging.Enabled === false) {
			distribution.DistributionConfig.Logging.Bucket = '';
			distribution.DistributionConfig.Logging.Prefix = '';
		}

		if (distribution.DistributionConfig.Origins.Items instanceof Array &&
			distribution.DistributionConfig.Origins.Items[0].S3OriginConfig &&
			distribution.DistributionConfig.Origins.Items[0].S3OriginConfig.OriginAccessIdentity === null) {
			distribution.DistributionConfig.Origins.Items[0].S3OriginConfig.OriginAccessIdentity = '';
		}

		if (distribution.DistributionConfig.DefaultRootObject === configDefaultRootObj &&
			distribution.DistributionConfig.Origins.Items[0].OriginPath === bucketPrefix) {
			console.log('Distribution default root object (', configDefaultRootObj, ') not changed, no update needed');
			console.log('Distribution origin path (', bucketPrefix, ') not changed, no update needed');
			return distribution;
		}

		distribution.DistributionConfig.DefaultRootObject = configDefaultRootObj;
		// OriginPath must start with slash, and not have trailing slash
		distribution.DistributionConfig.Origins.Items[0].OriginPath = !self.config.s3Options.Prefix ? '' : '/' + bucketPrefix.replace(/^(\\|\/)/, '').replace(/(\\\/)*$/, '');
		return self.cloudfrontFn('updateDistribution', {
			Id: distribution.Id,
			IfMatch: distribution.ETag,
			DistributionConfig: distribution.DistributionConfig
		}).then(function (response) {
			console.log('Default cloudfront distribution (Id:', distribution.Id, ') default root object updated to:', configDefaultRootObj);
			return distribution;
		});
	});
};

Sync.prototype.s3Fn = function s3Fn(methodName, opts, opts2) {
	return this.promisifyAWS('S3', methodName, opts, opts2);
};

Sync.prototype.cloudfrontFn = function cloudfrontFn(methodName, opts, opts2) {
	return this.promisifyAWS('cloudfront', methodName, opts, opts2);
};

Sync.prototype.promisifyAWS = function (awsAPI, methodName, opts, opts2) {
	var self = this;
	var args = arguments;
	// console.log('promisifyAWS -- args:', arguments);
	return new Promise(function (resolve, reject) {
		var fn;
		if (args.length < 4) {
			fn = self[awsAPI][methodName](opts);
		}
		else if (args.length === 4) {
			fn = self[awsAPI][methodName](opts, opts2);
		}// needed for `upload` and `getSignedUrl` S3 methods
		else {
			throw new Error('Unknown/unhandled method with argument length greater than 3');
		}

		fn.on('success', function (response) {
			if (!self.config.enableBucketCORS || awsAPI !== 'S3' || (self.config.enableBucketCORS && methodName !== 'createBucket')) {
				return resolve(response);
			}

			// Make sure all buckets created have CORS support for uploading files with pre-signed URL
			self.S3.putBucketCors({
				Bucket: opts.Bucket,
				CORSConfiguration: {
					CORSRules: [{
						AllowedOrigins: ['*'],
						AllowedHeaders: ['*'],
						AllowedMethods: ['GET', 'PUT', 'DELETE', 'POST'],
						MaxAgeSeconds: 30000
					}]
				}
			}).on('success', resolve).on('error', reject).send();
		}).on('error', reject).send();
	});
};

/**
 * Run a generator function
 * @param gen
 */
function run(gen) {
	var iter = gen(function (err, data) {
		if (err) { iter.throw(err); }
		return iter.next(data);
	});
	iter.next();
}
