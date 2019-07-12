## What is this?
It's pretty straightforward to manage file upload. Everybody can do it with using multipart/form-data encoding RFC 1867. Let's see what happens:

* client sends POST request with the file content in BODY
* webserver accepts the request and initiates data transfer (or returns error 413 if the file size is exceed the limit)
* webserver starts to populate buffers (depends on file and buffers size), store it on disk and send it via socket/network to back-end
* back-end verifies the authentication (take a look, once file is uploaded)
* back-end reads the file and cuts few headers Content-Disposition, Content-Type, stores it on disk again
* back-end performs all you need to do with the file

Too much overhead? It happens all the time you upload something. The problems are obvious:

* authentication happens on back-end after the file being saved on disk by webserver
* the BODY request saves on disk twice (on web-server and back-end sides both)
* back-end blocks while eating your file
* resulted binary-data rarely required by back-end itself, because images usually use by Imagemagic, documents upload on S3 or something else

To be honest I can see no problem due to small file size upload. But what if you handle big files upload all the time? Let's assume you use Nginx web-server, so you have several options:

* nginx-upload-module widely used, but not supported with Nginx 1.3.9+
* nginx-big-upload too young, nobody uses it in production yet
* lua-resty-upload requires few external dependencies
* clientbodyinfileonly Nginx built-in functionality

## How to use
The best and production-ready solution is the last one, clientbodyinfileonly. Due to lack of documentation nobody uses it, but let me share with experience how to setup it. First of all you need to use premature authentication before file uploading is started - Basic HTTP Authentication (shared password) or httpauthrequest module (for back-end authentication through headers). Then update nginx configuration with the following config:
```
location /upload {
        limit_except POST              { deny all; }
        client_body_temp_path          /tmp/nginx; //depend on where your whan to save file
        client_body_in_file_only       on;
        client_body_buffer_size        128K;
        client_max_body_size           50M;
        proxy_pass_request_headers     on;
        #proxy_set_header content-type "text/html";
        proxy_set_header               X-FILE $request_body_file;
        proxy_set_body                 $request_body_file;
        proxy_pass                     http://localhost:8080/; //or another adress refencer to ur middleware
        proxy_redirect                 off;
        }
```  
Once you reload nginx, the new URL /upload is ready to accept file upload without any back-end interaction, it all goes through nginx and send callback to http://localhost:8080/ with file name in X-FILE header. It's all, easy?

You already know the file name before you make POST request, so you should preserve it until the back-end receive it. We do use extra headers with POST that pass through Nginx proxy and comes to back-end unmodified. For instance, having X-NAME headers from initial requests help you to catch it up on backend.

If you need to have back-end authentication, only way to handle is to use auth_request, for instance:
> location = /upload {
  auth_request               /upload/authenticate;
  ...
    }

And

> location = /upload/authenticate {
  internal;
  proxy_set_body             off;
  proxy_pass                 http://backend;
}

Upload request should come with headers to be validated, for instance X-API-KEY, once authentication is finished, Nginx started to file uploading and pass the file name to backend afterward. It's internal cascade of requests, so you have to do only one request with file BODY and authentication headers. The good news that auth_request module will be incorporated in the Nginx core soon, so we can use it without ./configure ... --add-module=/tmp/ngxhttpauth_request

P.S. clientbodyinfileonly incompatible with multi-part data upload, so you can use it via XMLHttpRequest2 (without multi-part) and binary data upload only


#Based on : https://coderwall.com/p/swgfvw/nginx-direct-file-upload-without-passing-them-through-backend
#And inspired by : http://stackoverflow.com/questions/36429470/nginx-file-upload-with-client-body-in-file-only
