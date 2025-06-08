<?php

$index = file_get_contents('build/index.html');
$styles = file_get_contents('build/static/css/main.css');
$js = file_get_contents('build/static/js/main.js');

$styletarget = '<link href="/static/css/main.css" rel="stylesheet">';
$jstarget = '<script defer="defer" src="/static/js/main.js"></script>';

$index = str_replace($styletarget, "<style>$styles</style>", $index);
$index = str_replace($jstarget, "<script type='module'>$js</script>", $index);

file_put_contents('dist/index.html', $index);
