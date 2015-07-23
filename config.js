var config = {
	localDir:                  '../../_public', //'./empty' ||
	deleteRemoved:             true, // default false
	ensureBucketWebsite: true,
	bucketWebsite:       {
		IndexDocument: {Suffix: 'index.html'},
		ErrorDocument: {Key: 'index.html'},
		RoutingRules:  [{
			Condition: {HttpErrorCodeReturnedEquals: '404'},
			Redirect:  {
				HostName:             'my.domain.com',
				ReplaceKeyPrefixWith: '#!/'
			}
		}]
	},
	s3Options:                 {
		ALC:             'public-read',
		Bucket:          'mybucket-austin',
		accessKeyId:     'myaccessKeyId',
		secretAccessKey: 'mySecretAccessKey',
		region:          'us-east-1',
		Prefix:          ''
	}
};

module.exports = config;
