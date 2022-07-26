npx @solid/community-server -p 3002 &
sleep 10 # this is arbitrary
curl 'http://localhost:3002/setup' -X POST -H 'Accept: application/json' -H 'Accept-Language: en-US,en;q=0.5' -H 'Accept-Encoding: gzip, deflate, br' -H 'Referer: http://localhost:3002/setup' -H 'content-type: application/json' -H 'Origin: http://localhost:3002' -H 'Connection: keep-alive' -H 'Cookie: _session=XHif3npbji0CXe4V-8H6R; _session.legacy=XHif3npbji0CXe4V-8H6R; _session.sig=xqA4L4MR3XGIb61YCW2yunx5tNM; _session.legacy.sig=U8wFgLFIgZguURyGMBMtIo2cKxI' -H 'Sec-Fetch-Dest: empty' -H 'Sec-Fetch-Mode: cors' -H 'Sec-Fetch-Site: same-origin' --data-raw '{"registration":"on","createWebId":"on","webId":"","register":"on","createPod":"on","rootPod":"on","podName":"","email":"test@mail.com","password":"test","confirmPassword":"test"}'
printf "LOGIN DETAILS:\n    email: test@mail.com\n    password: test\n"
npx jest
kill $(lsof -t -i:3002)

