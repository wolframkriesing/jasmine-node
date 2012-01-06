var jasmine = require('./index');
var util,
    path = require('path');
try {
  util = require('util')
} catch(e) {
  util = require('sys')
}
var exec = require('child_process').exec;


var specFolder = null;

for (var key in jasmine)
  global[key] = jasmine[key];

var isVerbose = false;
var showColors = true;
var teamcity = process.env.TEAMCITY_PROJECT_NAME || false;
var useRequireJs = false;
var extentions = "js";
var match = '.'
var watchDir = null;

var junitreport = {
  report: false,
  savePath : "./reports/",
  useDotNotation: true,
  consolidate: true
}

var args = process.argv.slice(2);

while(args.length) {
  var arg = args.shift();

  switch(arg)
  {
    case '--color':
      showColors = true;
      break;
    case '--noColor':
    case '--nocolor':
      showColors = false;
      break;
    case '--verbose':
      isVerbose = true;
      break;
    case '--coffee':
      require('coffee-script');
      extentions = "js|coffee";
      break;
    case '-m':
    case '--match':
      match = args.shift();
      break;
    case '--junitreport':
        junitreport.report = true;
        break;
    case '--teamcity':
        teamcity = true;
        break;
    case '--runWithRequireJs':
        useRequireJs = true;
        break;
    case '-w':
    case '--watchDir':
        watchDir = args.shift();
        break;
    case '--test-dir':
        var dir = args.shift();

        if(!path.existsSync(dir))
          throw new Error("Test root path '" + dir + "' doesn't exist!");

        specFolder = dir; // NOTE: Does not look from current working directory.
        break;
    case '-h':
        help();
    default:
      if (arg.match(/^--/)) help();
      specFolder = path.join(process.cwd(), arg);
      break;
  }
}

if (!specFolder) {
  help();
}

var exitCode = 0;

process.on("exit", onExit);

function onExit() {
  process.removeListener("exit", onExit);
  process.exit(exitCode);
}

var onComplete = function(runner, log) {
  util.print('\nDone.\n');
  if (runner.results().failedCount == 0) {
    exitCode = 0;
  } else {
    exitCode = 1;
  }
};

jasmine.loadHelpersInFolder(specFolder,
                            new RegExp("[-_]helper\\.(" + extentions + ")$"));

function executeSpecsInFolder(onDone) {
  var onDoneFunc = function(){
    onComplete.apply(null, arguments);
    if (onDone) onDone();
    // TODO what's the clean way to clean up the jasmine env and the reporters?
    jasmine.getEnv().reporter.subReporters_ = [];
  }
  jasmine.executeSpecsInFolder(
    specFolder,
    onDoneFunc,
    isVerbose,
    showColors,
    teamcity,
    useRequireJs,
    new RegExp(match + ".*spec\\." + extentions + "$", 'i'),
    junitreport
  );
}

var lastChecked = +new Date(); // INit value is when the script started to run.
function watchDirAndReRun(directoryName){
  var diffInSecs = (+new Date() - lastChecked) / 1000;
  var cmd = 'find ' + directoryName + ' -type f -mtime -' + (~~diffInSecs) + 's';
  exec(cmd, function(error, stdout) {
    if (!error){
      lastChecked = +new Date();
      if (stdout){
        console.log('filss changed, rerunning tests  ', stdout.split('\n').join('\n  '));
        executeSpecsInFolder(function(){
          keepWatching(directoryName);
        });
        return;
      }
    } else {
      console.log(error);
    }
    keepWatching(directoryName);
  });
}

function keepWatching(directoryName){
  setTimeout(function(){
    watchDirAndReRun(directoryName);
  }, 1000);
}

executeSpecsInFolder(function(){
  if (watchDir){
    watchDirAndReRun(path.join(process.cwd(), watchDir));
  }
});

function help(){
  util.print([
    'USAGE: jasmine-node [--color|--noColor] [--verbose] [--coffee] directory'
  , ''
  , 'Options:'
  , '  --color            - use color coding for output'
  , '  --noColor          - do not use color coding for output'
  , '  -m, --match REGEXP - load only specs containing "REGEXPspec"'
  , '  --verbose          - print extra information per each test run'
  , '  --coffee           - load coffee-script which allows execution .coffee files'
  , '  --junitreport      - export tests results as junitreport xml format'
  , '  --teamcity         - converts all console output to teamcity custom test runner commands. (Normally auto detected.)'
  , '  --runWithRequireJs - loads all specs using requirejs instead of node\'s native require method'
  , '  --test-dir         - the absolute root directory path where tests are located'
  , '  -w, --watchDir     - watch the given directory and re-run tests whenever something changes in there'
  , '  -h, --help         - display this help and exit'
  , ''
  ].join("\n"));

  process.exit(-1);
}
