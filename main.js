var vkontakte = require('vkontakte');
var fs = require('fs');
var request = require('request');
var progress = require('request-progress');
var vkAuth = require('./vk/auth.js');
var path = require('path');
var sanitize = require('sanitize-filename');
var Q = require('q');

var ViewModel = function () {
    var self = this;
    self.folder = ko.observable();
    self.audios = ko.observableArray();
    
    var GPpause = false;
    self.groupDownloding = ko.observable(false);
    self.groupCount = ko.observable(5);
    self.groupCount.subscribe(function (value) {
        value = parseInt(value);
        if(isNaN(value)) {
            self.groupCount(5);
        } else if(value < 1) {
            self.groupCount(1);
        } else if(value > 10) {
            self.groupCount(10);
        }
    });
    
    self.downloadAllPause = function() {
        GPpause = true;
    };
    
    self.downloadAll = function() {
        if (!self.folder()) {
            alert('Please select directory first');
            return;
        }
        
        self.groupDownloding(true);
        
        var audios = self.audios();
        var index = 0;
        var group = self.groupCount();
        
        function NextGroup() {
            var array = [];
            for(var i=index; ((i<index+group) && (i<audios.length)); i++) {
                array.push(self.downloadAudio(audios[i]));
            }
            index += group;
            return Q.all(array);
        }
        
        function check() {
            if(GPpause) {
                GPpause = false;
                self.groupDownloding(false)
                return;
            }
            if(index>=audios.length) {
                GPpause = false;
                self.groupDownloding(false);
                index = 0;
                return;
            }
            
            NextGroup().then(function(args) {
                check();
            });
        }
        
        check();
    };
    
    self.downloadAudio = function (audio) {
        var defer = Q.defer();
        
        if (!self.folder()) {
            alert('Please select directory first');
            return;
        }

        var timer = setTimeout(function() {
            finish(false);
        }, 3 * 60 * 1000); // 3 mins
        
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
                finish(false);
            })
            .pipe(fs.createWriteStream(path.join(self.folder(), sanitize(audio.title) + '.mp3')))
            .on('error', function (err) {
                alert(err.message);
                audio.download(downloadStates.notStarted);
                finish(false);
            })
            .on('close', function (err) {
                audio.download(downloadStates.completed);
                finish(true);
            });

        audio.download(downloadStates.progress);
        
        function finish(status) {
            defer.resolve(status);
            clearTimeout(timer);
        }
        
        return defer.promise;
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