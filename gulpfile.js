const gulp = require('gulp');
const babel = require('gulp-babel')
const uglify = require('gulp-uglify');
const pump = require('pump');

gulp.task('watch', function()
{
    gulp.watch('client/js/**/*.js', ['uglify']);
});

gulp.task('uglify', function(cb)
{
    pump([
        gulp.src('client/js/**/*.js'),
        babel(
            {
                presets: ['es2015']
            }),
        uglify(),
        gulp.dest('public/js')
    ],
        cb
    );
});

gulp.task('default', ['uglify', 'watch']);