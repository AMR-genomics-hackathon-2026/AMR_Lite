# Deployment Guide: Getting AMR Lite Online

AMR Lite is a **static web application** — no backend server required. This guide covers multiple deployment options ranging from free to enterprise-grade hosting.

## 🚀 Quick Deployment Options

| Platform | Cost | Setup Time | Best For | Custom Domain |
|----------|------|-----------|----------|---------------|
| **GitHub Pages** | Free | 2 min | Hosted on GitHub already | Yes (free) |
| **Netlify** | Free | 3 min | Simple, drag-drop deployment | Yes (free) |
| **Vercel** | Free | 3 min | Auto-deploy on git push | Yes (free) |
| **AWS S3 + CloudFront** | $1-5/mo | 10 min | Scale, performance | Yes (paid) |
| **Local Server** | Free | 1 min | Testing only | No |

---

## 1️⃣ GitHub Pages (Easiest if Already on GitHub)

### Setup
```bash
cd amr-lite
```

### Option A: Deploy from main branch

1. Go to your GitHub repository settings
2. Navigate to **Settings → Pages → Build and deployment**
3. Select:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **(root)**
4. Click **Save**

Your app will be available at: `https://<username>.github.io/<repo-name>`

### Option B: Deploy from /docs folder

1. Push your code to GitHub
2. Create a `/docs` folder and copy all AMR Lite files into it
3. Go to **Settings → Pages**
4. Select:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/docs**
5. Save

### Custom Domain (Optional)
1. Go to **Settings → Pages**
2. Under "Custom domain", enter your domain (e.g., `amr-lite.mylab.org`)
3. Update DNS records at your domain registrar to point to GitHub Pages

---

## 2️⃣ Netlify (Recommended - Most User-Friendly)

### Method A: Drag & Drop

1. Go to [Netlify.com](https://netlify.com)
2. Sign up (GitHub login recommended)
3. Click **Add new site → Deploy manually**
4. Drag and drop your `amr-lite` folder onto the drop zone
5. Done! Your site is live at `https://<random-name>.netlify.app`

### Method B: Connect Git Repository

1. Sign up on [Netlify.com](https://netlify.com)
2. Click **Add new site → Import an existing project**
3. Connect your GitHub account
4. Select the AMRbrowser_plus repository
5. Configure build settings:
   - Base directory: `amr-lite`
   - Build command: (leave empty)
   - Publish directory: `amr-lite`
6. Click **Deploy site**

### Custom Domain
1. In Netlify dashboard, go to **Domain management**
2. Click **Add domain**
3. Enter your domain name
4. Netlify will provide DNS records to add to your registrar
5. HTTPS is automatic

### Continuous Deployment
- Every push to GitHub automatically deploys to Netlify
- Perfect for ongoing development

---

## 3️⃣ Vercel (Fast, Modern)

### Setup

1. Go to [Vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Click **Import Project**
4. Select your GitHub repository
5. Configure:
   - Root directory: `amr-lite`
   - Build command: (leave empty)
   - Install command: `npm install` (optional if using pako)
6. Click **Deploy**

### Result
- Automatically deployed to `https://amr-lite.vercel.app`
- Custom domain available in project settings
- Auto-deploys on every git push

---

## 4️⃣ AWS S3 + CloudFront (Enterprise-Grade)

### Step 1: Create S3 Bucket

```bash
# Install AWS CLI (if not already installed)
brew install awscli

# Configure AWS credentials
aws configure

# Create bucket
aws s3 mb s3://amr-lite-production --region us-east-1

# Enable static website hosting
aws s3api put-bucket-policy --bucket amr-lite-production --policy '{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::amr-lite-production/*"
  }]
}'
```

### Step 2: Upload Files

```bash
cd amr-lite

# Upload all files to S3
aws s3 sync . s3://amr-lite-production/ \
  --exclude "node_modules/*" \
  --exclude ".git/*" \
  --exclude "*.md" \
  --cache-control "max-age=3600"

# Upload database with longer cache (it changes rarely)
aws s3 cp data/amr_signatures_sequences.json.gz \
  s3://amr-lite-production/data/ \
  --cache-control "max-age=2592000"
```

### Step 3: Create CloudFront Distribution

```bash
aws cloudfront create-distribution --distribution-config '{
  "CallerReference": "'$(date +%s)'",
  "DefaultRootObject": "index.html",
  "Origins": {
    "Quantity": 1,
    "Items": [{
      "Id": "S3Origin",
      "DomainName": "amr-lite-production.s3.amazonaws.com",
      "S3OriginConfig": {}
    }]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3Origin",
    "ViewerProtocolPolicy": "redirect-to-https",
    "TrustedSigners": { "Enabled": false, "Quantity": 0 },
    "ForwardedValues": { "QueryString": false, "Cookies": { "Forward": "none" } },
    "MinTTL": 0
  },
  "Enabled": true
}'
```

### Step 4: Assign Custom Domain (Optional)

- Update Route 53 DNS records to point to CloudFront distribution
- Add SSL certificate via AWS Certificate Manager

### Cost Estimate
- S3 storage: ~$0.50/month (for ~1.2 MB database)
- CloudFront bandwidth: ~$0.085 per GB (typically <100 MB/month = <$10)
- **Total**: ~$1-5/month

---

## 5️⃣ Self-Hosted (Any Linux Server)

### Option A: Apache

```bash
# Copy files to web root
sudo cp -r amr-lite /var/www/html/

# Set permissions
sudo chown -R www-data:www-data /var/www/html/amr-lite

# Enable site
sudo a2ensite amr-lite

# Restart
sudo systemctl restart apache2
```

### Option B: Nginx

```bash
# Copy files
sudo cp -r amr-lite /usr/share/nginx/html/

# Create config
sudo nano /etc/nginx/sites-available/amr-lite
```

Add:
```nginx
server {
    listen 80;
    server_name amr-lite.mylab.org;

    location / {
        root /usr/share/nginx/html/amr-lite;
        try_files $uri $uri/ /index.html;
    }

    # Cache database files longer
    location ~* \.(json\.gz)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Cache common files
    location ~* \.(js|css|png|jpg|svg)$ {
        expires 7d;
    }
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/amr-lite /etc/nginx/sites-enabled/
sudo systemctl restart nginx
```

### Option C: Python Development Server (Testing Only)

```bash
cd amr-lite
python3 -m http.server 8000
```

Open: `http://localhost:8000`

---

## 🌍 Setting Up a Custom Domain

### For GitHub Pages or Netlify
1. Register a domain at [Namecheap](https://namecheap.com), [GoDaddy](https://godaddy.com), or your registrar
2. Update DNS `A` or `ALIAS` records to point to platform's servers
3. Add domain in platform settings

### Example (Namecheap → GitHub Pages)
- Go to Namecheap Domain Settings
- Find DNS Records
- Add:
  - Type: `A` | Host: `@` | Value: `185.199.108.153`
  - Type: `CNAME` | Host: `www` | Value: `<username>.github.io`

---

## 📦 Managing Large Database Files

The sequence database is **1.2 MB gzipped** and should load in <2 seconds over any reasonable connection.

### CDN Configuration (Optional)

For large installations or international users:

**Netlify** (Automatic):
- Built-in global CDN
- Database cached at edge nodes
- No setup needed

**Vercel** (Automatic):
- Global Vercel edge network
- Auto-optimized for JSON.gz files
- No setup needed

**AWS S3 + CloudFront** (Manual):
```bash
# CloudFront will cache .json.gz files by default
# Cache behavior: 30 days for .json.gz, 1 day for .js/.css
```

### Browser Caching Headers

Add to your web server config:

**Apache .htaccess**:
```apache
<FilesMatch "\.json\.gz$">
    Header set Cache-Control "public, max-age=2592000"
</FilesMatch>
<FilesMatch "\.js$">
    Header set Cache-Control "public, max-age=86400"
</FilesMatch>
```

**Nginx**:
```nginx
location ~* \.(json\.gz)$ {
    expires 30d;
}
location ~* \.(js|css)$ {
    expires 1d;
}
```

---

## ✅ Pre-Deployment Checklist

- [ ] Logo is displayed correctly in header (`AMR_lite_logo.png`)
- [ ] Database files included: `data/amr_signatures_sequences.json.gz`
- [ ] Cache busters updated (if needed)
- [ ] WebR error handling doesn't block analysis
- [ ] Results table renders immediately after analysis
- [ ] FASTA parsing works with .fasta, .fa, .fna, .gz extensions
- [ ] Download results as CSV/JSON works
- [ ] Responsive design works on mobile (test with 600px width)
- [ ] README includes logo and credits
- [ ] No console errors on initial load

---

## 🧪 Testing Your Deployment

### Functional Tests
1. Upload a test genome (provided in `test-data/` if available)
2. Verify analysis completes in <10 seconds
3. Check results table appears
4. Download CSV and verify data
5. Test sorting by each column
6. Test filtering by gene name

### Performance Tests
1. Check database loads: DevTools → Network tab → `amr_signatures_sequences.json.gz`
   - Should be <2 seconds
   - Size: 1.2 MB (gzipped)
2. Check First Contentful Paint (FCP): <2 seconds
3. Check analysis time: <10 seconds for 5 MB genome

### Browser Compatibility
- ✅ Chrome/Chromium 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ⚠️ IE11: Not supported (uses ES6 modules)

---

## 🚨 Troubleshooting

### Database file not found
- Ensure `data/amr_signatures_sequences.json.gz` is deployed
- Check browser DevTools → Network tab for 404 errors
- Verify file path in `signature-loader.js` matches deployment structure

### Analysis very slow
- Check database file cache-control headers
- Verify gzip compression is enabled on server
- Test with smaller genome file first

### CORS errors (if embedding in iframe)
- Add CORS headers: `Access-Control-Allow-Origin: *`
- Not needed if self-hosted or using Netlify/Vercel (automatic)

### WebR error message still showing
- Error is non-blocking (JavaScript fallback works)
- Check browser console for detailed error
- This is expected if CDN is unavailable

---

## 📞 Support & Next Steps

1. **For GitHub Pages**: [GitHub Pages Docs](https://docs.github.com/en/pages)
2. **For Netlify**: [Netlify Documentation](https://docs.netlify.com)
3. **For Vercel**: [Vercel Documentation](https://vercel.com/docs)
4. **For AWS**: [AWS S3 Static Website Hosting](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html)

---

## 🎯 Recommendation

**For fastest setup**: Use **Netlify** (drag-drop, automatic HTTPS, free custom domain)
**For GitHub users**: Use **GitHub Pages** (integrated, free, zero configuration)
**For production scale**: Use **AWS S3 + CloudFront** (pay-as-you-go, global CDN)

Good luck with your deployment! 🚀
