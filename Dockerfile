
FROM node:20-slim

# Install ClamAV
RUN apt-get update && apt-get install -y \
    clamav \
    clamav-daemon \
    wget

# Copy the freshclam.conf file with the mirror configuration
COPY freshclam.conf /etc/clamav/freshclam.conf

# Update virus definitions
RUN freshclam --config-file=/etc/clamav/freshclam.conf

# Create and change to the app directory.
WORKDIR /usr/src/app


COPY package*.json ./


RUN npm install --omit=dev


COPY . .

CMD [ "npm", "start" ]
