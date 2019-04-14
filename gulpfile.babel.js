import { src, dest, series, watch, parallel } from 'gulp';
import plumber from 'gulp-plumber';
import sass, { logError } from 'gulp-sass';
import csso from 'gulp-csso';
import autoprefixer from 'gulp-autoprefixer';
import { init, stream } from 'browser-sync';
import hash from 'gulp-hash-filename';
import mediaQueries from 'gulp-group-css-media-queries';
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
    store: {},

    set(key = String.prototype, name = String.prototype) {
        if (!this.store[key]) this.store[key] = [];
        this.store[key].push(name);
    },

    get(key = String.prototype, callbackfn = Function.prototype) {
        if (!this.store[key]) return null;
        let result = callbackfn(this.store[key]);
        return result ? result : this.store[key];
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

function remove(done) {
    sync(folder.build);
    done();
}

function server() {
    return init({
        server: {
            baseDir: folder.build,
            notify: true
        }
    });
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
        .pipe(mediaQueries())
        .pipe(csso())
        .pipe(
            hash({
                format: '{name}.{hash}{ext}'
            })
        )
        .pipe(tap(({ basename }) => filename.set('styles', basename)))
        .pipe(dest(joinPath(folder.build, path.styles.build)));
}

function stylesDev() {
    return styles()
        .pipe(tap(({ basename }) => filename.set('styles', basename)))
        .pipe(
            dest(joinPath(folder.build, path.styles.build), {
                sourcemaps: true
            })
        )
        .pipe(stream());
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
        .pipe(dest(folder.build))
        .pipe(stream());
}

function watcher() {
    watch(joinPath(folder.src, path.styles.watch), series(stylesDev));
    watch(joinPath(folder.src, path.html.watch), series(html));
}

export const clear = remove;
export const build = series(clear, stylesBuild, html);
export const dev = parallel(series(stylesDev, html), watcher, server);
export default series(clear, dev);
