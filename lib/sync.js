var s3 = require('s3'),
	Promise = require('bluebird'),
	_ = require('lodash');

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
	this.client = s3.createClient(config);
	this.AWS = s3.AWS;
	this.AWS.config.update(config.s3Options);
	this.S3 = new this.AWS.S3();
	this.cloudfront = new this.AWS.CloudFront({apiVersion: '2015-04-17'});
	this.config = config;

	var params = {
		localDir: config.localDir,
		deleteRemoved: config.deleteRemoved,
		s3Params: {
			Bucket: config.s3Options.Bucket,
			Prefix: config.s3Options.Prefix || '',
			ACL: config.s3Options.ACL || 'public-read'
		}
	};

	self.ensureBucketExists().then(function() {
		if (!config.ensureBucketWebsite) return;
		return self.ensureBucketWebsite();
	}).then(function() {
		var uploader = self.client.uploadDir(params);
		uploader.on('error', function(err) {
			console.error("unable to sync:", err.stack);
		});
		uploader.on('progress', function() {
			console.log("progress", uploader.progressAmount, uploader.progressTotal,
				Math.round(((uploader.progressAmount || 1) / (uploader.progressTotal || 1)) * 1000) / 10 + '%');
		});
		uploader.on('end', function() {
			console.log("done uploading");
			process.exit(0);
		});
	}).catch(function(err) {
		console.error('Error occurred during sync:', err);
	});
}

Sync.prototype.ensureBucketExists = function() {
	var self = this;
	return this.s3Fn('listBuckets').then(function(response) {
		console.log('buckets:', _.pluck(response.data.Buckets, 'Name'));
		if (_.find(response.data.Buckets, {Name: self.config.s3Options.Bucket})) return response;
		return self.s3Fn('createBucket', {
			Bucket: self.config.s3Options.Bucket,
			ACL: 'public-read'
		});
	});
};

Sync.prototype.ensureBucketWebsite = function() {
	var self = this,
		config = self.config;
	return this.s3Fn('getBucketWebsite', {Bucket: config.s3Options.Bucket}).then(function (response) {
		console.log('Current bucket website:\n', require('util').inspect(response.data, {depth: null, colors: true}));
		var bucketWebsite = response.data;
		bucketWebsite = _.merge(bucketWebsite, config.bucketWebsite);
		bucketWebsite = {Bucket: self.config.s3Options.Bucket, WebsiteConfiguration: bucketWebsite};
		return bucketWebsite;
	}).then(function(bucketWebsite) {
		console.log('PUT new bucket website:\n', require('util').inspect(bucketWebsite.WebsiteConfiguration, {depth: null, colors: true}));
		return self.s3Fn('putBucketWebsite', bucketWebsite);
	});
};

Sync.prototype.s3Fn = function s3Fn(methodName, opts, opts2) {
	var self = this;
	var args = arguments;
	// console.log('s3Fn -- args:', arguments);
	return new Promise(function(resolve, reject) {
		var fn;
		if (args.length < 3) fn = self.S3[methodName](opts);
		else if (args.length === 3) fn = self.S3[methodName](opts, opts2); // needed for `upload` and `getSignedUrl` S3 methods
		else throw new Error('Unknown/unhandled method with argument length greater than 3');

		fn.on('success', function(response) {
			if (methodName !== 'createBucket') {
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
