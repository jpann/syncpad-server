var gulp = require('gulp');
var babel = require('gulp-babel')
var uglify = require('gulp-uglify');
var pump = require('pump');

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