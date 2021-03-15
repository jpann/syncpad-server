var gulp = require('gulp');
var uglify = require('gulp-uglify');
const pump = require('pump');

gulp.task('uglify', function(cb)
{
    pump([
        gulp.src('client/js/**/*.js'),
        uglify(),
        gulp.dest('public/js')
        ],
        cb
    );
});

gulp.task('watch', function()
{
    gulp.watch('client/js/**/*.js', ['uglify']);
});