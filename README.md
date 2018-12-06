# Latency checker backend with bearer user auth

## Requirements
 - Node.js>=7(with ES6 support)
 - MongoDB
 - Docker(optional)

## Installation
### Localhost
 - Clone this repository
 - Install dependencies in project folder
```sh
$ npm install
```
 - Start application
```sh
$ npm start
```
By default, appliction trying to connect to local MongoDB instance, to change connection url simply add MONGO_CONNECTION_URL environment variable, eg:
```sh
$ MONGO_CONNECTION_URL=mongodb://mongo/app npm start
```
### Using Docker Compose
```sh
$ docker-compose up
```

## Use
```
http://localhost:4000/[uri]
```