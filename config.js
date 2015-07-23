var config = {
	localDir: '../../_public', //'./empty' ||
	deleteRemoved: true, // default false
	s3Options: {
		ALC:                'public-read',
		Bucket:             'mybucket-austin',
		accessKeyId:        'myaccessKeyId',
		secretAccessKey:    'mySecretAccessKey',
		region:             'us-east-1',
		Prefix:             ''
	}
};

module.exports = config;
