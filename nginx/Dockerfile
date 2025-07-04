FROM nginx:alpine

# Generate SSL certificates
RUN mkdir -p /etc/ssl/private && mkdir -p /etc/ssl/certs

# Copy the Nginx configuration file
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
COPY ./certificate.crt /etc/ssl/certs/signed.crt
COPY ./private.key /etc/ssl/private/signed.key

# Expose ports 80 and 443 for HTTP and HTTPS traffic
EXPOSE 80 443

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
