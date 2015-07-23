# Questis Site Sync

## Introduction

QSS is a deployment helper. It allows synchronization to the cloud of a directory of static files to be used as a website behind a CDN.

It contains the following:

## Setup

1. Install [Node.js](http://nodejs.org/). Consider using [NVM](https://github.com/creationix/nvm) to do this.
2. Open a terminal window, clone the repo and navigate to the project directory.
3. Execute the command `npm install` to install all package dependencies.
4. Run `node ./` to begin synchronization.

## Options

Command line options:
* -b, -bucket -- The S3 bucket to use. Overrides config file bucket value if provided
* -c, -config -- Relative (or absolute) config file path to override/extend defaults from __dirname

Example config file (.js):
```JavaScript
    localDir: '../../_public',
    deleteRemoved: true, // default false
    s3Options: {
        ALC:                'public-read',
        Bucket:             'mybucket',
        accessKeyId:        'myAccessKey',
        secretAccessKey:    'mySecretAccessKey',
        region:             'us-east-1',
        Prefix:             ''
    }
```
