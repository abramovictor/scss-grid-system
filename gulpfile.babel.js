import { src, dest, series, watch, parallel } from 'gulp';
import plumber from 'gulp-plumber';
import sass, { logError } from 'gulp-sass';
import csso from 'gulp-csso';
import autoprefixer from 'gulp-autoprefixer';
import { init, stream, reload } from 'browser-sync';
import hash from 'gulp-hash-filename';
import mediaQueriesGroup from 'gulp-group-css-media-queries';
import template from 'gulp-template';
import { sync } from 'del';
import tap from 'gulp-tap';

function joinPath(...path) {
    let str = '';
    path.forEach((item, index, { length }) => {
        str += `${item}${index === length - 1 ? '' : '/'}`;
    });
    return str;
}

const filename = {
    _store: {},

    set(key = String.prototype, name = String.prototype) {
        if (!this._store[key]) return (this._store[key] = [name]);

        this._store[key] = this._store[key].filter(item => {
            if (item !== name) return item;
        });

        return this._store[key].push(name);
    },
    get(key = String.prototype, callbackfn = Function.prototype) {
        if (!this._store[key]) return null;
        let result = callbackfn(this._store[key]);
        return result ? result : this._store[key];
    },
    clear(key = String.prototype) {
        if (!this._store[key]) return null;
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

function remove(path = String.prototype) {
    return function clear(done = Function.prototype) {
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
        .pipe(
            template({
                styles: filename.get('styles', files => {
                    let link = '';

                    files.forEach(file => {
                        link += `<link rel="stylesheet" href="${joinPath(
                            path.styles.build,
                            file
                        )}">`;
                    });

                    return link;
                })
            })
        )
        .pipe(dest(folder.build));
}

function styles() {
    return src(joinPath(folder.src, path.styles.src), { sourcemaps: true })
        .pipe(plumber())
        .pipe(sass().on('error', logError));
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
                html();
            })
        )
        .pipe(dest(joinPath(folder.build, path.styles.build)));
}

function stylesDev() {
    return styles()
        .pipe(
            tap(({ basename }) => {
                filename.set('styles', basename);
                html();
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
    watch(joinPath(folder.src, path.styles.watch), series(stylesDev));
    watch(joinPath(folder.src, path.html.watch), reload);
}

export const removeBuild = remove(folder.build);
export const build = series(removeBuild, stylesBuild);
export const dev = parallel(series(stylesDev), watcher, server);
export default series(removeBuild, dev);
