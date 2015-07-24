# S3 Site Sync (and creation)

## Introduction

S3SS is a deployment helper. It allows synchronization to the cloud of a local directory of static files to be used as a website behind a Cloudfront distribution (CDN). If the S3 bucket does not exist for the account with the given S3 credentials, then it tries to create it (will fail on creating duplicate bucket name). It will also set it up for CORS uploads. When creating the bucket it enables it to work as an S3 website. If the bucket already exists, then it ensures that it is set up to work as an S3 website. It will search for a cloudfront distribution that already exists for the given bucket (based on distribution origins), if it does not find one then it will set one up to work with the given/created S3 bucket. Make sure to read the [Notes](#notes) section at the bottom...

Can be used as a CLI tool or node module. When used from CLI you must specify the `-r` parameter.

## Setup

1. Install [Node.js](http://nodejs.org/). Consider using [NVM](https://github.com/creationix/nvm) to do this.
2. Open a terminal window, clone the repo and navigate to the project directory.
3. Execute the command `npm install` to install all package dependencies.
4. Run `node ./` to begin synchronization.

## As a CLI Tool:

Command line options:
* -r, -run       	       -- Run from the command line. Must be present to other CLI options to function. No (value) required
* -c, -config    (value) -- Relative (or absolute) config file path to override/extend defaults from `__dirname`. See [config](#config) below
* -b, -bucket    (value) -- The S3 bucket to use. Overrides config file bucket value if provided
* -ld, -localDir (value) -- The local folder to sync. Overrides config file value

1. `npm install s3-site-sync` // Make sure the module is installed via NPM
2. `node s3-site-sync -r -c ./my-config.js` // Run S3SS with the config file in the current directory called `my-config.js`

## As a Node module:

1. `var s3ss = require('s3-site-sync');`
2. `var sync = new s3ss.Sync(require('my-config');` // Where `my-config` points to your site sync configuration file
3. `sync.then(function(result) {console.log('results:', results);})` // `Sync` returns a promise containing operation results:
	* `results.bucket` // The S3 bucket information
	* `results.bucketWebsite` // The S3 bucket website configuration (if enabled)
	* `results.cloudfrontDistribution` // The cloudfront distribution configuration (if enabled)

## Notes

* The sync functionality looks for an existing cloudfront distribution  with an origin domain (`config.cloudfrontDistribution
.DistributionConfig.Origins.Items.X.DomainName` to equal the bucket website URL - ie `mybucket.s3-website-us-east-1.amazonaws.com`). If
one exists then it will use the existing distribution without modification to any settings. If it does not exist, then it will be created
 and configured to work with an angular type application. ?
* If you want to point you website at the cloudfront distribution, make sure to set the `Aliases` in your config accordingly. NOTE: Any
aliases specified cannot exist in another distribution or it will throw an error back from AWS.
* If you wish to use SSL, make sure to set the `ViewerCertificate` in your config accordingly
* This "should" work with any AWS region, but only tested with 'us-east-1'

## Configuration
Example (default) config.js file for angular website:
```JavaScript
    localDir: '../../_public',
    deleteRemoved: true,
	ensureBucketWebsite: true,
	bucketWebsite:       {
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
    s3Options: {
        ALC:                'public-read',
        Bucket:             'mybucket',
        accessKeyId:        'myAccessKey',
        secretAccessKey:    'mySecretAccessKey',
        region:             'us-east-1',
        Prefix:             ''
    },
    ensureDistribution: true,
    cloudfrontDistribution: {
		DistributionConfig: {
			Comment:              'Created by s3-site-sync', /* required */
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
						/*S3OriginConfig:     { // Needed if private S3 bucket/objects
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
			/*Logging:              {
			 Bucket:         'STRING_VALUE', /!* required *!/
			 Enabled:        true || false, /!* required *!/
			 IncludeCookies: true || false, /!* required *!/
			 Prefix:         'STRING_VALUE' /!* required *!/
			 },*/
			PriceClass:           'PriceClass_100', // USA/Europe (PriceClass_100 | PriceClass_200 | PriceClass_All)
			Restrictions:         {
				GeoRestriction: { /* required */
					Quantity:        0, /* required */
					RestrictionType: 'none', /* required (blacklist | whitelist | none) */
					Items:           [/* 'STRING_VALUE', more items */]
				}
			},
			ViewerCertificate:    {
				CloudFrontDefaultCertificate: false // (true || false) -- provide in imported config if desired
				// IAMCertificateId:             'iamCertId', // Your IAM SSL Certificate ID
				// MinimumProtocolVersion:       'TLSv1', // 'SSLv3 | TLSv1',
				// SSLSupportMethod:             'sni-only' // (sni-only | vip) -- VIP cost $$!!
			}
		}
	}
```
