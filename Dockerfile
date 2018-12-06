FROM node:10.14.1
RUN mkdir /app
WORKDIR /app
ADD . /app
RUN NODE_ENV=production npm install