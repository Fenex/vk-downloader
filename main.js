var vkontakte = require('vkontakte');
var fs = require('fs');
var request = require('request');
var progress = require('request-progress');
var vkAuth = require('./vk/auth.js');
var path = require('path');
var sanitize = require('sanitize-filename');

var ViewModel = function () {
    var self = this;
    self.folder = ko.observable();
    self.audios = ko.observableArray();
    self.downloadAudio = function (audio) {
        if (!self.folder()) {
            alert('Please select directory first');
            return;
        }

        progress(request(audio.url), {
            throttle: 500,
            delay: 500
        })
            .on('progress', function (state) {
                audio.progress(state.percent);
            })
            .on('error', function (err) {
                alert(err.message);
                audio.download(downloadStates.notStarted);

            })
            .pipe(fs.createWriteStream(path.join(self.folder(), sanitize(audio.title) + '.mp3')))
            .on('error', function (err) {
                alert(err.message);
                audio.download(downloadStates.notStarted);
            })
            .on('close', function (err) {
                audio.download(downloadStates.completed);
            });

        audio.download(downloadStates.progress);
    };


    vkAuth(3965358, 'audio', '3.0').then(
        function (token) {
            var vk = vkontakte(token);
            vk('audio.get', {}, function (err, audios) {
                self.audios(audios.map(function (data) {
                    return new Audio(data);
                }));
            })
        },
        function (error) {
            alert(error);
        }
    );
}

var doc = document.getElementById('wrapper');
ko.applyBindings(new ViewModel(), doc);

var downloadStates = {
    notStarted: 0,
    progress: 1,
    completed: 2
}

var Audio = function (data) {
    this.title = data.artist + ' - ' + data.title;
    this.url = data.url;
    this.download = ko.observable(downloadStates.notStarted);
    this.progress = ko.observable(0);
    this.progressBarValue = ko.computed(function () {
        return this.progress() + '%';
    }, this);
}