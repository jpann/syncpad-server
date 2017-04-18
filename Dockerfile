FROM node:boron

ENV ADMIN_USER=admin
ENV ADMIN_PASS=password

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json /usr/src/app/
RUN npm install

# Bundle app source
COPY . /usr/src/app

# Create admin user
RUN node /usr/src/app/addAdmin.js $ADMIN_USER $ADMIN_PASS

EXPOSE 3000
CMD [ "npm", "start" ]