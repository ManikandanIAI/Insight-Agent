# Stage 1: Build the Next.js application
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY frontend/package.json ./
COPY frontend/package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY frontend .

# Build the Next.js application
RUN npm run build

# Stage 2: Serve the Next.js application
FROM python:3.10-slim AS runner

# Install wkhtmltopdf and dependencies
RUN apt-get update && apt-get install -y \
    wkhtmltopdf \
    wget \
    unzip \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies in case of chrome driver
# RUN apt-get update && apt-get install -y \
#     wget \
#     unzip \
#     ca-certificates \
#     fonts-liberation \
#     libappindicator3-1 \
#     libasound2 \
#     libatk-bridge2.0-0 \
#     libatk1.0-0 \
#     libc6 \
#     libcairo2 \
#     libcups2 \
#     libdbus-1-3 \
#     libexpat1 \
#     libfontconfig1 \
#     libgbm1 \
#     libgcc1 \
#     libglib2.0-0 \
#     libgtk-3-0 \
#     libnspr4 \
#     libnss3 \
#     libpango-1.0-0 \
#     libpangocairo-1.0-0 \
#     libstdc++6 \
#     libx11-6 \
#     libx11-xcb1 \
#     libxcb1 \
#     libxcomposite1 \
#     libxcursor1 \
#     libxdamage1 \
#     libxext6 \
#     libxfixes3 \
#     libxi6 \
#     libxrandr2 \
#     libxrender1 \
#     libxss1 \
#     libxtst6 \
#     lsb-release \
#     xdg-utils \
#     wkhtmltopdf \
#     && apt-get clean \
#     && rm -rf /var/lib/apt/lists/*

# Copy the requirements file first to install dependencies
COPY ./requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --root-user-action=ignore -r /app/requirements.txt

# # Download and install Google Chrome
# RUN wget https://storage.googleapis.com/chrome-for-testing-public/136.0.7103.94/linux64/chrome-linux64.zip -O /tmp/chrome-linux64.zip \
#     && unzip /tmp/chrome-linux64.zip -d /opt/ \
#     && rm /tmp/chrome-linux64.zip

# # Download and install Chrome WebDriver
# RUN wget https://storage.googleapis.com/chrome-for-testing-public/136.0.7103.94/linux64/chromedriver-linux64.zip -O /tmp/chromedriver-linux64.zip \
#     && unzip /tmp/chromedriver-linux64.zip -d /opt/ \
#     && rm /tmp/chromedriver-linux64.zip

# # Set the path for Chrome and ChromeDriver
# ENV PATH="/opt/chrome-linux64:${PATH}"
# ENV PATH="/opt/chromedriver-linux64:${PATH}"

# Set the working directory inside the container
WORKDIR /app

# Copy everything from the current directory (root) to /app in the container
COPY . /app/

# # Make chromedriver executable
# RUN chmod +x /opt/chromedriver-linux64/chromedriver

# Copy only the necessary files from the builder stage
COPY --from=builder /app/out ./out

# Expose port 8000 for HTTP traffic
EXPOSE 8000

# CMD to run the Python application using uvicorn
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
