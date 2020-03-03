import { src, dest, series, watch, parallel } from 'gulp';
import plumber from 'gulp-plumber';
import sass from 'gulp-sass';
import csso from 'gulp-csso';
import autoprefixer from 'gulp-autoprefixer';
import { init, stream, reload } from 'browser-sync';
import hash from 'gulp-hash-filename';
import mediaQueriesGroup from 'gulp-group-css-media-queries';
import template from 'gulp-template';
import { sync } from 'del';
import tap from 'gulp-tap';

function joinPath(...path) {
  return path.join('/');
}

const filename = {
  _store: {},

  /**
   * @param {string} key 
   * @param {string} name 
   */
  set(key, name) {
    if (!this._store[key]) return (
      this._store[key] = [name]
    );

    if (!this._store[key].includes(name)) {
      this._store[key].push(name)
    }

    return name;
  },

  /**
   * @param {string} key 
   * @param {function} callbackfn 
   */
  get(key, callbackfn) {
    if (!this._store[key]) return null;
    let result = callbackfn(this._store[key]);
    return result ? result : this._store[key];
  },

  /**
   * @param {string} key 
   * @return {boolean}
   */
  clear(key) {
    if (!this._store[key]) return false;
    this._store[key].length = 0;
    return true;
  }
};

const folder = {
  src: 'src',
  build: 'build'
};

const path = {
  styles: {
    src: 'styles/*.+(sc|c)ss',
    build: 'assets/css',
    watch: 'styles/**/*.+(sc|c)ss'
  },
  html: {
    src: '**/*.html',
    watch: '**/*.html'
  }
};

function reloadBrowser(done) {
  reload();
  done();
}

/** @param {string} path */
function remove(path) {
  return function clear(done) {
    sync(path);
    done();
  };
}

function server() {
  return init({
    server: {
      baseDir: folder.build,
      notify: true
    }
  });
}

function html() {
  return src(joinPath(folder.src, path.html.src))
    .pipe(plumber())
    .pipe(
      template({
        styles: filename.get('styles', files => {
          return files.reduce(
            (prev, file) => (
              prev.concat(
                `<link rel="stylesheet" href="${joinPath(path.styles.build, file)}">`
              )
            ), ''
          );
        })
      })
    )
    .pipe(dest(folder.build));
}

function styles() {
  return src(joinPath(folder.src, path.styles.src), { sourcemaps: true })
    .pipe(sass());
}

function stylesBuild() {
  return styles()
    .pipe(
      autoprefixer({
        browsers: ['last 2 versions', 'ie 11'],
        cascade: false
      })
    )
    .pipe(mediaQueriesGroup())
    .pipe(csso())
    .pipe(
      hash({
        format: '{name}.{hash}{ext}'
      })
    )
    .pipe(
      tap(({ basename }) => {
        filename.set('styles', basename);
      })
    )
    .pipe(dest(joinPath(folder.build, path.styles.build)));
}

function stylesDev() {
  return styles()
    .pipe(
      tap(({ basename }) => {
        filename.set('styles', basename);
      })
    )
    .pipe(
      dest(joinPath(folder.build, path.styles.build), {
        sourcemaps: true
      })
    )
    .pipe(stream());
}

function watcher() {
  watch(joinPath(folder.src, path.styles.watch), series(stylesDev, html));
  watch(joinPath(folder.src, path.html.watch), series(html, reloadBrowser));
}

export const removeBuild = remove(folder.build);
export const build = series(removeBuild, stylesBuild, html);
export const dev = parallel(series(stylesDev, html), watcher, server);
export default series(removeBuild, dev);
