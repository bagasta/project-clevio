# Deployment Guide - Clevio Pro

## Overview

Panduan ini menjelaskan cara melakukan deployment Clevio Pro WhatsApp Management System ke berbagai environment, mulai dari development hingga production.

## Prerequisites

### System Requirements
- **OS**: Ubuntu 18.04+ / CentOS 7+ / Windows 10+ / macOS 10.14+
- **Node.js**: Version 16.x atau lebih tinggi
- **RAM**: Minimum 2GB, Recommended 4GB+
- **Storage**: Minimum 5GB free space
- **Network**: Internet connection untuk WhatsApp Web API

### Dependencies
- Google Chrome atau Chromium browser
- PM2 (untuk production)
- Nginx (optional, untuk reverse proxy)
- SSL Certificate (untuk HTTPS)

## Development Deployment

### Local Development
```bash
# Clone project
git clone <repository-url>
cd clevio-pro

# Install dependencies
npm run install-all

# Start development servers
npm run dev
```

Aplikasi akan berjalan di:
- Dashboard: http://localhost:4000
- API: http://localhost:3000

### Development dengan Docker
```dockerfile
# Dockerfile
FROM node:18-alpine

# Install Chrome dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Set Chrome path
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app
COPY . .

RUN npm run install-all

EXPOSE 3000 4000

CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  clevio-pro:
    build: .
    ports:
      - "3000:3000"
      - "4000:4000"
    volumes:
      - ./.wwebjs_auth:/app/.wwebjs_auth
      - ./.wwebjs_cache:/app/.wwebjs_cache
    environment:
      - NODE_ENV=development
    restart: unless-stopped
```

## Production Deployment

### 1. Server Preparation

#### Ubuntu/Debian
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Chrome
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
sudo apt update
sudo apt install -y google-chrome-stable

# Install PM2
sudo npm install -g pm2

# Install Nginx (optional)
sudo apt install -y nginx
```

#### CentOS/RHEL
```bash
# Update system
sudo yum update -y

# Install Node.js
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install Chrome
sudo yum install -y wget
wget https://dl.google.com/linux/direct/google-chrome-stable_current_x86_64.rpm
sudo yum localinstall -y google-chrome-stable_current_x86_64.rpm

# Install PM2
sudo npm install -g pm2
```

### 2. Application Deployment

```bash
# Create application directory
sudo mkdir -p /opt/clevio-pro
sudo chown $USER:$USER /opt/clevio-pro

# Clone and setup application
cd /opt/clevio-pro
git clone <repository-url> .
npm run install-all

# Create production environment file
cp .env .env.production
```

### 3. Environment Configuration

Edit `.env.production`:
```env
# Production Configuration
NODE_ENV=production

# Dashboard
USERNAME=your_secure_username
PASSWORD=your_strong_password
SESSION_SECRET=your_random_secret_key_here
DASHBOARD_PORT=4000

# API
PORT=3000

# Security
CORS_ORIGIN=https://yourdomain.com
```

### 4. PM2 Configuration

Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [
    {
      name: 'clevio-dashboard',
      cwd: '/opt/clevio-pro/dashboard-server',
      script: 'dashboard-server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 4000
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      error_file: '/var/log/clevio-pro/dashboard-error.log',
      out_file: '/var/log/clevio-pro/dashboard-out.log',
      log_file: '/var/log/clevio-pro/dashboard-combined.log',
      time: true
    },
    {
      name: 'clevio-api',
      cwd: '/opt/clevio-pro/whatsapp-api',
      script: 'whatsapp-api.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      error_file: '/var/log/clevio-pro/api-error.log',
      out_file: '/var/log/clevio-pro/api-out.log',
      log_file: '/var/log/clevio-pro/api-combined.log',
      time: true
    }
  ]
};
```

### 5. Start Services

```bash
# Create log directory
sudo mkdir -p /var/log/clevio-pro
sudo chown $USER:$USER /var/log/clevio-pro

# Start applications with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup
pm2 startup
# Follow the instructions provided by PM2
```

### 6. Nginx Reverse Proxy (Optional)

Create `/etc/nginx/sites-available/clevio-pro`:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    # SSL Configuration
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Dashboard
    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # SSE support
        proxy_buffering off;
        proxy_cache off;
    }
    
    # API
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # CORS headers
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
        add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization";
        
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin *;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
            add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization";
            add_header Content-Length 0;
            add_header Content-Type text/plain;
            return 200;
        }
    }
    
    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/clevio-pro /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7. SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add this line:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

## Cloud Deployment

### AWS EC2

1. **Launch EC2 Instance**
   - AMI: Ubuntu Server 20.04 LTS
   - Instance Type: t3.medium (minimum)
   - Security Group: Allow ports 22, 80, 443

2. **Setup Application**
   ```bash
   # Connect to instance
   ssh -i your-key.pem ubuntu@your-instance-ip
   
   # Follow production deployment steps above
   ```

3. **Load Balancer (Optional)**
   - Create Application Load Balancer
   - Configure target groups for ports 3000 and 4000
   - Setup health checks

### Google Cloud Platform

1. **Create Compute Engine Instance**
   ```bash
   gcloud compute instances create clevio-pro-instance \
     --zone=us-central1-a \
     --machine-type=e2-medium \
     --image-family=ubuntu-2004-lts \
     --image-project=ubuntu-os-cloud \
     --boot-disk-size=20GB
   ```

2. **Setup Firewall Rules**
   ```bash
   gcloud compute firewall-rules create allow-clevio-pro \
     --allow tcp:80,tcp:443 \
     --source-ranges 0.0.0.0/0
   ```

### DigitalOcean

1. **Create Droplet**
   - Image: Ubuntu 20.04 x64
   - Size: 2GB RAM / 1 vCPU (minimum)
   - Add SSH key

2. **Setup Application**
   ```bash
   # Connect via SSH
   ssh root@your-droplet-ip
   
   # Follow production deployment steps
   ```

### Heroku

Create `Procfile`:
```
web: npm start
```

Create `app.json`:
```json
{
  "name": "Clevio Pro",
  "description": "WhatsApp Management System",
  "repository": "https://github.com/your-repo/clevio-pro",
  "keywords": ["whatsapp", "api", "dashboard"],
  "env": {
    "NODE_ENV": {
      "value": "production"
    },
    "USERNAME": {
      "description": "Dashboard username"
    },
    "PASSWORD": {
      "description": "Dashboard password"
    },
    "SESSION_SECRET": {
      "generator": "secret"
    }
  },
  "buildpacks": [
    {
      "url": "https://github.com/jontewks/puppeteer-heroku-buildpack"
    },
    {
      "url": "heroku/nodejs"
    }
  ]
}
```

Deploy:
```bash
# Install Heroku CLI
# Create Heroku app
heroku create your-app-name

# Set environment variables
heroku config:set USERNAME=admin
heroku config:set PASSWORD=your-password
heroku config:set SESSION_SECRET=your-secret

# Deploy
git push heroku main
```

## Monitoring & Maintenance

### PM2 Monitoring
```bash
# View status
pm2 status

# View logs
pm2 logs

# Restart applications
pm2 restart all

# Monitor resources
pm2 monit
```

### Log Rotation
```bash
# Install logrotate configuration
sudo tee /etc/logrotate.d/clevio-pro << EOF
/var/log/clevio-pro/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
```

### Health Checks
Create monitoring script `health-check.sh`:
```bash
#!/bin/bash

# Check if services are running
if ! pm2 list | grep -q "online"; then
    echo "Services are down, restarting..."
    pm2 restart all
    # Send notification (email, Slack, etc.)
fi

# Check disk space
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "Disk usage is above 80%"
    # Send alert
fi

# Check memory usage
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
if [ $MEMORY_USAGE -gt 80 ]; then
    echo "Memory usage is above 80%"
    # Send alert
fi
```

Add to crontab:
```bash
# Run health check every 5 minutes
*/5 * * * * /opt/clevio-pro/health-check.sh
```

### Backup Strategy
```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backup/clevio-pro"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup WhatsApp sessions
tar -czf $BACKUP_DIR/sessions_$DATE.tar.gz /opt/clevio-pro/.wwebjs_auth

# Backup configuration
cp /opt/clevio-pro/.env $BACKUP_DIR/env_$DATE

# Remove old backups (keep last 30 days)
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
find $BACKUP_DIR -name "env_*" -mtime +30 -delete
```

### Security Considerations

1. **Firewall Configuration**
   ```bash
   # UFW (Ubuntu)
   sudo ufw allow ssh
   sudo ufw allow 80
   sudo ufw allow 443
   sudo ufw enable
   ```

2. **Fail2Ban**
   ```bash
   sudo apt install fail2ban
   
   # Configure for Nginx
   sudo tee /etc/fail2ban/jail.local << EOF
   [nginx-http-auth]
   enabled = true
   port = http,https
   logpath = /var/log/nginx/error.log
   EOF
   
   sudo systemctl restart fail2ban
   ```

3. **Regular Updates**
   ```bash
   # System updates
   sudo apt update && sudo apt upgrade -y
   
   # Node.js dependencies
   cd /opt/clevio-pro
   npm audit fix
   npm update
   ```

## Troubleshooting

### Common Issues

1. **Chrome/Puppeteer Issues**
   ```bash
   # Install missing dependencies
   sudo apt install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget
   ```

2. **Memory Issues**
   ```bash
   # Increase swap space
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```

3. **Port Conflicts**
   ```bash
   # Check what's using the port
   sudo netstat -tulpn | grep :3000
   sudo netstat -tulpn | grep :4000
   
   # Kill process if needed
   sudo kill -9 <PID>
   ```

### Performance Optimization

1. **Node.js Optimization**
   ```bash
   # Increase Node.js memory limit
   export NODE_OPTIONS="--max-old-space-size=2048"
   ```

2. **Nginx Optimization**
   ```nginx
   # Add to nginx.conf
   worker_processes auto;
   worker_connections 1024;
   keepalive_timeout 65;
   gzip on;
   gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
   ```

3. **PM2 Optimization**
   ```javascript
   // In ecosystem.config.js
   max_memory_restart: '500M',
   node_args: '--max-old-space-size=512'
   ```

## Rollback Strategy

1. **Application Rollback**
   ```bash
   # Stop current version
   pm2 stop all
   
   # Restore from backup
   cd /opt/clevio-pro
   git checkout previous-stable-tag
   npm run install-all
   
   # Restart services
   pm2 start ecosystem.config.js
   ```

2. **Database/Session Rollback**
   ```bash
   # Restore WhatsApp sessions
   cd /opt/clevio-pro
   rm -rf .wwebjs_auth
   tar -xzf /backup/clevio-pro/sessions_YYYYMMDD_HHMMSS.tar.gz
   ```

---

Untuk informasi lebih lanjut atau bantuan deployment, silakan hubungi tim support atau buat issue di repository.

