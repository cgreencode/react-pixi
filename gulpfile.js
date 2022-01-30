var exec = require('child_process').exec;
var path = require('path');

var gulp = require('gulp');
var concat = require('gulp-concat');
var vsource = require('vinyl-source-stream');
var streamify = require('gulp-streamify');
var jshint = require('gulp-jshint');
var livereload = require('gulp-livereload');
var gutil = require('gulp-util');
var header = require('gulp-header');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');

var karma = require('karma');
var browserify = require('browserify');
var pkg = require('./package.json');

var SERVERPORT = 8080;
var SOURCEGLOB = './src/**/*.js';
var EXAMPLESGLOB = './examples/**/*.js';

var OUTPUTFILE = 'react-pixi';

var banner = ['/**',
             ' * <%= pkg.name %>',
             ' * @version <%= pkg.version %>',
             ' * @license <%= pkg.license %>',
             ' */',
             ''].join('\n');

var browserlist = ['PhantomJS'];
var karmaconfiguration = {
    browsers: browserlist,
    files: ['vendor/pixi.dev.js',
            'build/react-pixi.js',
            'vendor/phantomjs-shims.js', // need a shim to work with the ancient version of Webkit used in PhantomJS
            'node_modules/resemblejs/resemble.js',
            'test/pixels/pixelTests.js',
            'test/basics/*.js',
            'test/components/*.js',
            {pattern:'test/pixels/*.png',included:false, served:true} // for render tests
           ],
    frameworks:['jasmine'],
    singleRun:true
};

function errorHandler(err) {
  gutil.log(err);
  this.emit('end'); // so that gulp knows the task is done
}

gulp.task('help', function() {
  console.log('Possible tasks:');
  console.log('"default" - compile react-pixi into build/react-pixi.js');
  console.log('"watch" - watch react-pixi source files and rebuild');
  console.log('"test" - run tests in test directory');
  console.log('"livereload" - compile and launch web server/reload server');
  console.log('"pixelrefs" - generate reference images for render-specific tests');
});

gulp.task('lint', function() {
  return gulp.src([SOURCEGLOB,EXAMPLESGLOB])
    .pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish'));
});

gulp.task('browserify',['lint'], function() {
  var bundler = browserify();
  bundler.require('react');
  bundler.require('./src/ReactPIXI.js',{expose:'react-pixi'});

  return bundler.bundle().on('error', errorHandler)
    .pipe(vsource('react-pixi-commonjs.js'))
    .pipe(gulp.dest('build'));
});

gulp.task('bundle', ['browserify'], function() {

  // If we're running a gulp.watch and browserify finds and error, it will
  // throw an exception and terminate gulp unless we catch the error event.
  return gulp.src(['build/react-pixi-commonjs.js','src/react-pixi-exposeglobals.js'])
    .pipe(concat('react-pixi.js'))
    .pipe(gulp.dest('build'))

     // might as well compress it while we're here

    .pipe(streamify(uglify({preserveComments:'some'})))
    .pipe(rename(OUTPUTFILE + '.min.js'))
    .pipe(gulp.dest('build'));
});

gulp.task('watch', ['bundle'], function() {
  gulp.watch(SOURCEGLOB, ['browserify']);
});

gulp.task('livereload', ['lint','bundle'], function() {
  var nodestatic = require('node-static');
  var fileserver = new nodestatic.Server('.');
  require('http').createServer(function(request, response) {
    request.addListener('end', function() {
      fileserver.serve(request,response);
    }).resume();
  }).listen(SERVERPORT);

  var livereloadserver = livereload();

  gulp.watch([SOURCEGLOB], ['bundle']);
  gulp.watch(['build/**/*.js', 'examples/**/*.js','examples/**/*.html'], function(file) {
    livereloadserver.changed(file.path);
  });
});

gulp.task('test', ['bundle'], function() {
  karma.server.start(karmaconfiguration, function (exitCode) {
    gutil.log('Karma has exited with code ' + exitCode);
    process.exit(exitCode);
  });
});

gulp.task('pixelrefs', function() {
  var command = path.normalize('./node_modules/.bin/phantomjs');
  var child = exec(command + ' test/pixels/generatetestrender.js',
                  function(error, stdout, stderr) {
                    gutil.log('result of reference image generation:\n' + stdout);
                    if (stderr.length > 0) {
                      gutil.log('stderr: ' + stderr);
                    }
                    if (error !== null) {
                      gutil.log('exec error: ' + error);
                    }
                  });
});

gulp.task('default', ['lint','bundle']);

