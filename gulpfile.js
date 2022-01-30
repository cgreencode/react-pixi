
var gulp = require('gulp');
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

var isTravisCI = (typeof process.env.TRAVIS !== 'undefined' && process.env.TRAVIS === 'true');
var SERVERPORT = 8080;
var SOURCEGLOB = './src/**/*.js';
var OUTPUTFILE = 'react-pixi';

var banner = ['/**',
             ' * <%= pkg.name %>',
             ' * @version <%= pkg.version %>',
             ' * @license <%= pkg.license %>',
             ' */',
             ''].join('\n');

// Travis has firefox, not chrome
var browserlist = ['PhantomJS'];
if (isTravisCI) {
  browserlist.push('Firefox');
} else {
  browserlist.push('Chrome');
}
var karmaconfiguration = {
    browsers: browserlist,
    files: ['vendor/pixi.js',
            'build/react-pixi.js',
            // need a shim to work with the ancient version of Webkit used in PhantomJS
            'vendor/phantomjs-shims.js',
            'test/**/*.js'],
    frameworks:['jasmine'],
    singleRun:true
};


function errorHandler(err) {
  gutil.log(err);
  this.emit('end'); // so that gulp knows the task is done
}

gulp.task('lint', function() {
  return gulp.src(SOURCEGLOB)
    .pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish'));
});

gulp.task('browserify', ['lint'], function() {
  var bundler = browserify();
  bundler.require('./src/ReactPIXI.js', {expose:'react-pixi'});
  bundler.require('react');

  // If we're running a gulp.watch and browserify finds and error, it will
  // throw an exception and terminate gulp unless we catch the error event.
  return bundler.bundle().on('error', errorHandler)
    .pipe(vsource(OUTPUTFILE + '.js'))
    .pipe(gulp.dest('build'));
});

gulp.task('compress', ['browserify'], function() {
  return gulp.src('build/' + OUTPUTFILE + '.js')
    .pipe(uglify())
    .pipe(rename(OUTPUTFILE + '.min.js'))
    .pipe(gulp.dest('build'));
});

// need to add uglify in here eventually


gulp.task('watch', ['browserify'], function() {
  gulp.watch(SOURCEGLOB, ['browserify']);
});

gulp.task('livereload', ['lint','browserify'], function() {
  var nodestatic = require('node-static');
  var fileserver = new nodestatic.Server('.');
  require('http').createServer(function(request, response) {
    request.addListener('end', function() {
      fileserver.serve(request,response);
    }).resume();
  }).listen(SERVERPORT);

  var livereloadserver = livereload();

  gulp.watch([SOURCEGLOB], ['browserify']);
  gulp.watch(OUTPUTFILE, function(file) {
    livereloadserver.changed(file.path);
  });
});

gulp.task('test', ['browserify'], function() {
  karma.server.start(karmaconfiguration, function (exitCode) {
    gutil.log('Karma has exited with code ' + exitCode);
    process.exit(exitCode);
  });
});


gulp.task('default', ['lint','browserify']);

