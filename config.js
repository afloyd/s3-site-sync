var config = {
	localDir:               '../../_public', //'./empty' ||
	deleteRemoved:          true,
	enableBucketCORS:       true,
	ensureBucketWebsite:    true,
	bucketWebsite:          {
		IndexDocument: {Suffix: 'index.html'},
		ErrorDocument: {Key: 'index.html'},
		RoutingRules:  [{
			Condition: {HttpErrorCodeReturnedEquals: '404'},
			Redirect:  {
				HostName:             null, // will be filled in pragmatically, or you can override with your config.js
				ReplaceKeyPrefixWith: '#!/'
			}
		}]
	},
	s3Options:              {
		ALC:             'public-read',
		Bucket:          'mybucket',
		accessKeyId:     'myaccessKeyId',
		secretAccessKey: 'mySecretAccessKey',
		region:          'us-east-1',
		Prefix:          ''
	},
	ensureDistribution:     true,
	cloudfrontDistribution: {
		DistributionConfig: {
			Comment:              'Created by s3-site-sync', /* required -- can override with empty string/etc if desired */
			DefaultCacheBehavior: { /* required */
				ForwardedValues:      { /* required */
					Cookies:     { /* required */
						Forward:   'none' // /*, // required (none | whitelist | all) */
						/*WhitelistedNames: { // optional
							Quantity: 0, /!* required *!/
							Items:    [
								'STRING_VALUE' /!* more items *!/
							]
						}*/
					},
					QueryString: true /*, // required (true | false) */
					/*Headers:     { //optionsl
						Quantity: 0 /!*, // required *!/
						/!*Items:    [
							'STRING_VALUE',
							/!* more items *!/
						]*!/
					}*/
				},
				MinTTL:               0, /* required */
				TargetOriginId:       'Custom-mybucket.s3-website-us-east-1.amazonaws.com', /* required, leave blank -- filled in
                                                                                                      pragmatically */
				TrustedSigners:       { /* required */
					Enabled:  false, /* required (true || false) */
					Quantity: 0, /* required */
					Items:    [/* 'STRING_VALUE', 'more_items' */]
				},
				ViewerProtocolPolicy: 'redirect-to-https', /* required (allow-all | https-only | redirect-to-https) */
				AllowedMethods:       {
					Quantity:      3, /* required */
					Items:         ['HEAD', 'GET', 'OPTIONS'], /* required (GET | HEAD | POST | PUT | PATCH | OPTIONS | DELETE) */
					CachedMethods: {
						Quantity: 3, /* required */
						Items:    ['HEAD', 'GET', 'OPTIONS'] /* required (GET | HEAD | POST | PUT | PATCH | OPTIONS | DELETE) */
					}
				},
				/*DefaultTTL:           0,
				MaxTTL:               0, */
				SmoothStreaming:      false // (true || false)
			},
			Enabled:              true, /* required (true || false) */
			Origins:              { /* required */
				Quantity: 1, /* required */
				Items:    [
					{
						DomainName:         'mybucket.s3-website-us-east-1.amazonaws.com', /* required -- filled by module */
						Id:                 'Custom-mybucket.s3-website-us-east-1.amazonaws.com', /* required -- filled by module */
						CustomOriginConfig: {
							HTTPPort:             80, /* required */
							HTTPSPort:            443, /* required */
							OriginProtocolPolicy: 'http-only' /* required (http-only | match-viewer) NOTE: HTTPS will NOT work w/ S3 bucket
						                                          website!!*/
						}
						//, OriginPath:         'STRING_VALUE', // Needed if not root path
						/*S3OriginConfig:     { // Needed if private bucket/objects
							OriginAccessIdentity: 'STRING_VALUE' /!* required *!/
						}*/
					}
				]
			},
			Aliases:              { // Provide in imported config if desired, necessary if pointing CNAME/etc records to cloudfront
				Quantity: 0, /* required */
				Items:    [ /* 'STRING_VALUE', 'another_value' */ ]
			},
			CacheBehaviors:       {
				Quantity: 0, /* required */
				Items:    [
					/*{
						ForwardedValues:      {
							/!* required *!/
							Cookies:     {
								/!* required *!/
								Forward:          'none | whitelist | all', /!* required *!/
								WhitelistedNames: {
									Quantity: 0, /!* required *!/
									Items:    [
										'STRING_VALUE',
										/!* more items *!/
									]
								}
							},
							QueryString: true || false, /!* required *!/
							Headers:     {
								Quantity: 0, /!* required *!/
								Items:    [
									'STRING_VALUE',
									/!* more items *!/
								]
							}
						},
						MinTTL:               0, /!* required *!/
						PathPattern:          'STRING_VALUE', /!* required *!/
						TargetOriginId:       'STRING_VALUE', /!* required *!/
						TrustedSigners:       {
							/!* required *!/
							Enabled:  true || false, /!* required *!/
							Quantity: 0, /!* required *!/
							Items:    [
								'STRING_VALUE',
								/!* more items *!/
							]
						},
						ViewerProtocolPolicy: 'allow-all | https-only | redirect-to-https', /!* required *!/
						AllowedMethods:       {
							Items:         [/!* required *!/
								'GET | HEAD | POST | PUT | PATCH | OPTIONS | DELETE',
								/!* more items *!/
							],
							Quantity:      0, /!* required *!/
							CachedMethods: {
								Items:    [/!* required *!/
									'GET | HEAD | POST | PUT | PATCH | OPTIONS | DELETE',
									/!* more items *!/
								],
								Quantity: 0 /!* required *!/
							}
						},
						DefaultTTL:           0,
						MaxTTL:               0,
						SmoothStreaming:      true || false
					}*/ /* more items */
				]
			},
			CustomErrorResponses: {
				Quantity: 0, /* required */
				Items:    [
					/*{
						ErrorCode:          0, /!* required *!/
						ErrorCachingMinTTL: 0,
						ResponseCode:       'STRING_VALUE',
						ResponsePagePath:   'STRING_VALUE'
					}*/ /* more items */
				]
			},
			DefaultRootObject:    'index.html',
			Logging:              {
				Bucket:         '', /* required */
				Enabled:        false, /* required (true || false) */
				IncludeCookies: false, /* required (true || false) */
				Prefix:         '' /* required */
			},
			PriceClass:           'PriceClass_100', // USA/Europe (PriceClass_100 | PriceClass_200 | PriceClass_All)
			Restrictions:         {
				GeoRestriction: { /* required */
					Quantity:        0, /* required */
					RestrictionType: 'none', /* required (blacklist | whitelist | none) */
					Items:           [/* 'STRING_VALUE', more items */]
				}
			},
			ViewerCertificate:    {
				CloudFrontDefaultCertificate: true // (true || false) -- provide in imported config if desired & set to false
				// IAMCertificateId:             'iamCertId', // Your IAM SSL Certificate ID
				// MinimumProtocolVersion:       'TLSv1', // 'SSLv3 | TLSv1',
				// SSLSupportMethod:             'sni-only' // (sni-only | vip) -- VIP cost $$!!
			}
		}
	},
	ensureDistributionDefaultRootObj: false
};

module.exports = config;
