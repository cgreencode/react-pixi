//
// system-level requires
//

var exec = require('child_process').exec;
var path = require('path');
var envify = require('envify/custom');
var rimraf = require('rimraf');

//
// gulp-specific tools
//

var gulp = require('gulp');
var concat = require('gulp-concat');
var vsource = require('vinyl-source-stream');
var vtransform = require('vinyl-transform');
var jshint = require('gulp-jshint');
var template = require('gulp-template');
var livereload = require('gulp-livereload');
var gutil = require('gulp-util');
var uglify = require('gulp-uglify');
var jsxtransform = require('gulp-react');

//
// testing/packaging
//

var karma = require('karma');
var browserify = require('browserify');
var browserifyShim = require('browserify-shim');
var pkg = require('./package.json');

//
// config for the web server used to serve examples
//

var SERVERPORT = 8080;
var SOURCEGLOB = './src/**/*.js';
var EXAMPLESGLOB = './examples/**/*.js';

//
// final built output goes into build/<OUTPUTFILE>.js
//

var OUTPUTFILE = 'react-pixi';

var banner = ['/**',
              ' * <%= pkg.name %>',
              ' * @version <%= pkg.version %>',
              ' * @license <%= pkg.license %>',
              ' */',
              ''].join('\n');

var browserlist = ['Firefox'];
var karmaconfiguration = {
    browsers: browserlist,
    files: [require.resolve('lodash'),
            require.resolve('pixi.js'),
            'build/react-pixi.js',
            'vendor/phantomjs-shims.js', // need a shim to work with the ancient version of Webkit used in PhantomJS
            'node_modules/resemblejs/resemble.js',
            'test/createTestFixtureMountPoint.js',
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
  console.log('"test" - run tests in test directory');
  console.log('"dist" - compile react-pixi into dist/ directory for distribution');
  console.log('"dist-clojars" - generate files in dist-clojars/ which can be deployed via leiningen');
  console.log('"watch" - watch react-pixi source files and rebuild');
  console.log('"livereload" - compile and launch web server/reload server');
  console.log('"pixelrefs" - generate reference images for render-specific tests');
});

//
// the JSX example needs to be run through the jsx transform
//
gulp.task('jsxtransform', function() {
  return gulp.src('examples/jsxtransform/jsxtransform.jsx', {base:'examples/jsxtransform'})
    .pipe(jsxtransform())
    .pipe(gulp.dest('examples/jsxtransform'))
    .pipe(livereload());
});

gulp.task('lint', ['jsxtransform'], function() {
  return gulp.src([SOURCEGLOB,EXAMPLESGLOB])
    .pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish'));
});

gulp.task('browserify',['lint'], function() {
  var bundler = browserify();
  bundler.require('react');
  bundler.require('./src/ReactPIXI.js',{expose:'react-pixi'});
  bundler.transform(browserifyShim);

  // If we're running a gulp.watch and browserify finds an error, it will
  // throw an exception and terminate gulp unless we catch the error event.
  return bundler.bundle().on('error', errorHandler)
    .pipe(vsource('react-pixi-commonjs.js'))
    .pipe(gulp.dest('build'));
});

gulp.task('bundle', ['browserify'], function() {
  return gulp.src(['build/react-pixi-commonjs.js','src/react-pixi-exposeglobals.js'])
    .pipe(concat('react-pixi.js'))
    .pipe(vtransform(envify({NODE_ENV:"development"})))
    .pipe(gulp.dest('build'))
    .pipe(livereload());
});

gulp.task('bundle-min', ['browserify'], function() {
  return gulp.src(['build/react-pixi-commonjs.js','src/react-pixi-exposeglobals.js'])
    .pipe(concat('react-pixi.min.js'))
    .pipe(vtransform(envify({NODE_ENV:"production"})))
    .pipe(uglify({preserveComments:'some'}))
    .pipe(gulp.dest('build'))
    .pipe(livereload());
});

gulp.task('watch', ['bundle', 'bundle-min'], function() {
  gulp.watch(SOURCEGLOB, ['bundle','bundle-min']);
  gulp.watch(['examples/jsxtransform/*.jsx'], ['jsxtransform']);
  gulp.watch(EXAMPLESGLOB,['lint'])
});

gulp.task('livereload', ['lint','bundle','jsxtransform'], function() {
  var nodestatic = require('node-static');
  var fileserver = new nodestatic.Server('.');
  require('http').createServer(function(request, response) {
    request.addListener('end', function() {
      fileserver.serve(request,response);
    }).resume();
  }).listen(SERVERPORT);

  livereload.listen();

  gulp.watch([SOURCEGLOB], ['bundle','bundle-min']);
  gulp.watch(['examples/jsxtransform/*.jsx'], ['jsxtransform']);
});

gulp.task('test', ['bundle'], function(done) {
  karma.server.start(karmaconfiguration, function (exitCode) {
    gutil.log('Karma has exited with code ' + exitCode);
    done();
  });
});

gulp.task('dist-clean', function(done) {
  rimraf('dist', done);
});

// dist puts build results into dist/ for release via bower
gulp.task('dist', ['dist-clean','bundle', 'bundle-min', 'test'], function() {
  return gulp.src(['build/**'], {base:'build'})
    .pipe(gulp.dest('dist'));
});

//
// PACKAGING FOR CLOJURESCRIPT
//

//
// For easy use with ClojureScript (om-react-pixi) we need to
// arrange the files properly so that they may be properly
// packaged with leiningen. File are first arranged in dist-clojars
// and then packaged/deployed to clojars.org (currently by hand)
//
// This setup uses the new "dep.cljs" setup which requires a
// version of clojurescript after 0.0-2727

gulp.task('dist-clojars-clean', function(done) {
  rimraf('dist-clojars',done);
});

// Generate a leiningen project file for clojars. The source
// file itself is just a template so that we can fill in the
// version field. The version used is whatever is specified in package.json
gulp.task('dist-clojars-project', ['dist-clojars-clean'], function() {
  return gulp.src(['src/project_template.clj'], {base:'src'})
    .pipe(template({version:pkg.version}))
    .pipe(concat("project.clj"))
    .pipe(gulp.dest('dist-clojars/'));
});

// put the react-pixi javascript files into src/react_pixi (referred to in
// code as src/react-pixi)
gulp.task('dist-clojars-src', ['dist', 'dist-clojars-clean'], function() {
  return gulp.src(['dist/**'], {base:'dist'})
    .pipe(gulp.dest('dist-clojars/src/react_pixi'));
});

// Dump other files (like pixi itself) into the src/react_pixi dir
gulp.task('dist-clojars-pixi', ['dist-clojars-clean'], function() {
  return gulp.src(['node_modules/pixi.js/bin/**'], {base:'node_modules/pixi.js/bin'})
    .pipe(gulp.dest('dist-clojars/src/react_pixi'));
});

// Copy over dep.cljs
gulp.task('dist-clojars-deps', ['dist-clojars-clean'], function() {
  return gulp.src(['src/deps.cljs'],{base:'src'})
    .pipe(gulp.dest('dist-clojars/src'));
})

gulp.task('dist-clojars', ['dist-clojars-src','dist-clojars-project','dist-clojars-pixi','dist-clojars-deps'], function() {
  // user must run lein deploy in the subdir
  gutil.log('ready to deploy');
  gutil.log('chdir into the "dist-clojars" directory and run "lein deploy clojars"');
});

//
// generate the bitmap references used in testing
//

gulp.task('pixelrefs', ['bundle'], function(done) {
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
                    done();
                  });
});

gulp.task('default', ['bundle','bundle-min']);
