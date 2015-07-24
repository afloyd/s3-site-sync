var Sync = require('./lib/sync'),
    args   = getArgs(),
    config = require('./config'),
    path   = require('path'),
    _      = require('lodash');

var helpArgs = {
	'-r, -run':       'Run from the command line. Must be present to other CLI options to function.',
	'-c, -config':    'Relative (or absolute) config file path to override/extend defaults from __dirname',
	'-b, -bucket':    'The S3 bucket to use. Overrides config file bucket value if provided',
	'-ld, -localDir': 'The local folder to sync. Overrides config file value'
};

if (args.r || args.run) {
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
		var configLocation = path.resolve(__dirname, args.c || args.config);
		try {
			var mergeConf = require(configLocation);
		} catch (ex) {
			console.error('Invalid config file or location! --', configLocation, '\nerr:', ex);
			process.exit(1);
		}

		config = _.merge(config, mergeConf);
	}

	if (args.b || args.bucket) {
		config.s3Options = config.s3Options || {};
		config.s3Options.Bucket = args.b || args.bucket;
	}

	var commandLineLocalDir = args.ld || args.localDir;
	config.localDir = commandLineLocalDir ? path.resolve(__dirname, commandLineLocalDir) : config.localDir;

	return new Sync(config);
}

Sync.isModule = true;
module.exports = {
	Sync: Sync
};

function getArgs() {
	var args     = {},
	    argsList = process.argv.slice(2);
	for (var i = 0; i < argsList.length; i++) {
		var hasProp = false,
		    arg     = argsList[i].toLowerCase();
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
