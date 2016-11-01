var vkontakte = require('vkontakte');
var fs = require('fs');
var request = require('request');
var progress = require('request-progress');
var vkAuth = require('./vk/auth.js');
var path = require('path');
var sanitize = require('sanitize-filename');

angular.module('VKD', [])
.value('Settings', {
    dir: null
})
.factory('Audios', function(Audio) {
    var Audios = {};
    Audios.list = [];
    
    Audios.push = function(data) {
        Audios.list.push(Audio(data));
    };
    
    Audios.checkLocalFiles = function() {
        Audios.list.forEach(function(item) {
            item.checkLocalFile();
        });
    };
    
    return Audios;
})
.factory('Audio', function(Settings, $rootScope, $q) {
    var Audio = function(data) {
        for(var key in data) {
            this[key] = data[key];
        }
        
        this.artist = this.artist.trim();
        this.title = this.title.trim();
        this.name = sanitize(this.artist + ' - ' + this.title);
        
        this.progress = 0;
        
        this.isExistLocal = null;
        
        $rootScope.$watch(function() {
            return Settings.dir;
        }, function (a, b) {
            this.progress = 0;
            this.checkLocalFile();
        }.bind(this));
    }
    
    Audio.prototype.checkLocalFile = function() {
        var self = this;
        fs.stat(path.join(Settings.dir, self.name + '.mp3'), function(err, stats) {
            if(err)
                self.update({isExistLocal: false});
            else if(stats.isFile())
                self.update({isExistLocal: true});
            else
                self.update({isExistLocal: false});
        });
    };
    
    Audio.prototype.update = function(data) {
        for(var key in data) {
            this[key] = data[key];
        }
        $rootScope.$apply();
    };
    
    Audio.prototype.download = function() {
        var self = this;
        var defer = $q.defer();
        
        if(!Settings.dir)
            return alert('Please select directory first');
            
        if(this.isExistLocal)
            return;
        
        progress(request(this.url), {
            throttle: 500,
            delay: 500
        })
        .on('progress', function (state) {
            self.update({progress: state.percent});
        })
        .on('error', function (err) {
            alert(err.message);
            self.update({progress: 0});
            defer.reject(err.message);
        })
        .pipe(fs.createWriteStream(path.join(Settings.dir, this.name + '.mp3')))
        .on('error', function (err) {
            alert(err.message);
            self.update({progress: 0});
            defer.reject(err.message);
        })
        .on('close', function (err) {
            self.update({progress: 100, isExistLocal: true});
            defer.resolve();
        });
        
        return defer.promise;
    };
    
    Audio.prototype.toString = function() {
        return '[object VK-Audio]';
    };
    
    return function (data) {
        return new Audio(data);
    }
})
.run(function(Audios, $timeout) {
    vkAuth(3965358, 'audio', '3.0').then(
        function (token) {
            var vk = vkontakte(token);
            vk('audio.get', {}, function (err, audios) {
                $timeout(function() {
                    audios.map(function(data) {
                        Audios.push(data);
                    });
                });
            });
        },
        function (error) {
            alert(error);
        }
    );
})
.directive('nwdirectory', ['$timeout', function ($timeout) {
  return {
    restrict: "A",
    scope: {
      directoryPath: "=nwdirectory"
    },
    link: function (scope, element) {

      element.val(scope.directoryPath);
      element.data('old-value', scope.directoryPath);

      element.bind('change', function (blurEvent) {
        if (element.data('old-value') != element.val()) {
          $timeout(function () {
            scope.directoryPath = element.val();
            element.data('old-value', element.val());
          });
        }
      });
    }
  };
}])
.controller('MainCtrl', function(Settings, Audios) {
    var self = this;
    
    this.Audios = Audios;
    this.Settings = Settings;
    
    this.download = function(index) {
        Audios.list[index].download();
    };
    
    function downloadNext() {
        if(!downloading)
            return;
            
        for(var i=0; i < Audios.list.length; i++) {
            if(Audios.list[i].isExistLocal)
                continue;
            
            if(Audios.list[i].progress > 0)
                return;
            
            return Audios.list[i].download().then(function() {
                downloadNext();
            });
        }
        
        downloading = false;
    };
    
    var downloading = false;
    this.isDownloading = function() {
        return downloading;
    }
    this.downloadAll = function() {
        downloading = !downloading;
        downloadNext();
    };
});
