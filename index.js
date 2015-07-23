var args = getArgs(),
	config = require('./config'),
	path = require('path'),
	_ = require('lodash');

var helpArgs = {
	'-c, -config': 'Relative (or absolute) config file path to override/extend defaults from __dirname',
	'-b, -bucket': 'The S3 bucket to use. Overrides config file bucket value if provided'
};

if (args.h) {
	var keys = Object.keys(helpArgs);
	console.log('\nCommand line utility arguments:\n');
	for (var i = 0; i < keys.length; i++) {
		var key = keys[i];
		console.log('\t', key, '--', helpArgs[key]);
	}
	return;
}

if (args.c || args.config) {
	try {
		var mergeConf = require(args.c || args.config);
	} catch(ex) {
		console.error('Invalid config file or location!');
		process.exit(1);
	}

	config = _.merge(config, mergeConf);
}

if (args.b || args.bucket) {
	config.s3Options = config.s3Options || {};
	config.s3Options.bucket = args.b || args.bucket;
}

var Sync = require('./lib/sync');
new Sync(config);

function getArgs() {
	var args = {},
	    argsList = process.argv.slice(2);
	for (var i=0; i < argsList.length; i++) {
		var hasProp = false,
		    arg = argsList[i].toLowerCase();
		if (arg.substring(0, 1) === '-') {
			hasProp = true;
			arg = arg.substring(1);
		}

		var nextArg = argsList[i + 1] ? argsList[i + 1].toLowerCase() : null;
		if (!hasProp || !nextArg || nextArg.substring(0, 1) === '-') {
			args[arg] = true;
			continue;
		}

		args[arg] = nextArg;
		i += 1;
	}
	return args;
}
