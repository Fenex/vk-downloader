var nwGui = window.nwDispatcher.requireNwGui();

var params = {toolbar: false, resizable: false, show: true, height: 100, width: 320};

var authorize = function(clientId, scope, apiVersion) {
    var apiVer = apiVersion || '5.34';
    var authUrl = 'https://oauth.vk.com/authorize?client_id=' + clientId + '&scope=' + scope + '&redirect_uri=https://oauth.vk.com/blank.html&response_type=token&v=' + apiVer + '&display=popup';

    var promise = new Promise(function(resolve, reject) {
        var storedToken = window.localStorage.getItem('vk-token');
        if(storedToken) {
            var tokenObject = JSON.parse(storedToken);
            if(tokenObject.token && tokenObject.expires > new Date().getTime()) {
                resolve(tokenObject.token);
                return;
            }
        }

        var authWindow = nwGui.Window.open(authUrl, params);
        authWindow.on('document-end', function () {
            authWindow.focus();
            var interval = setInterval(function () {
                console.log(JSON.stringify(authWindow));
                var windowUrl = authWindow.window.location.href;
                if (windowUrl.indexOf('oauth.vk.com/blank.html#') > -1) {
                    authWindow.close();
                    clearInterval(interval);
                    var splitedURL = windowUrl.split("#");
                    var params = splitedURL[1];
                    var paramsArray = params.split("&");
                    var tokenParams = {};
                    for (var i = 0, length = paramsArray.length; i < length; i++) {
                        var splitedParam = paramsArray[i].split("=");
                        tokenParams[splitedParam[0]] = splitedParam[1];
                    }

                    if(tokenParams.error) {
                        reject(tokenParams.error_description);

                        return;
                    }

                    window.localStorage.setItem('vk-token', JSON.stringify({
                        token: tokenParams.access_token,
                        expires: new Date().getTime() + (23 * 60 * 60 * 1000)
                    }));

                    resolve(tokenParams.access_token);
                }
            }, 5);
            authWindow.on('close', function() {
                clearInterval(interval);
                reject('Auth window closed by user');
                this.close(true);
            })
        });
    });

    return promise;
};

module.exports = authorize;