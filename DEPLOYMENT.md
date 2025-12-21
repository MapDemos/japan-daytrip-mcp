# Deployment Guide - Japan Day Trip MCP Assistant

## Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│                     Production Setup                     │
└─────────────────────────────────────────────────────────┘

┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Frontend   │────────▶│    Lambda    │────────▶│  Claude API  │
│   (S3/CDN)   │  HTTPS  │ Proxy + Auth │  API Key│              │
└──────────────┘         └──────────────┘         └──────────────┘
                              │
                              │ Calls
                              ▼
                    ┌──────────────────┐
                    │   Rurubu API     │
                    │   Mapbox MCP     │
                    └──────────────────┘
```

## Current Status

✅ **Local Development Working**
- Frontend: Vite dev server (`npm start`)
- Backend: Node.js proxy (`npm run server`)
- Claude API: Working via proxy
- Rurubu MCP: Working
- Map Tools: Working

## Security Analysis

### ❌ What NOT to do:
```javascript
// NEVER expose API keys in frontend code
CLAUDE_API_KEY: 'sk-ant-...'  // ← Visible in bundled JS!
```

### ✅ Correct approach:
```
Frontend (S3) → Lambda (API key hidden) → Claude API
```

## Deployment Options

### Option 1: AWS Lambda + API Gateway (Recommended)

**Why:**
- ✅ Serverless - no server management
- ✅ Auto-scaling
- ✅ Cost-effective (~FREE for moderate usage)
- ✅ API keys secure in Lambda environment

**Files ready:**
- `lambda/handler.js` - Lambda function
- `lambda/deploy-lambda.sh` - Deployment script
- `lambda/README.md` - Full instructions

**Quick Deploy:**
```bash
# 1. Set API key
export CLAUDE_API_KEY="sk-ant-..."

# 2. Deploy Lambda
./lambda/deploy-lambda.sh

# 3. Create API Gateway (AWS Console)
# 4. Update config.js with API Gateway URL

# 5. Build and deploy frontend
npm run build
./deploy.sh
```

### Option 2: Keep Current Architecture (Full Stack)

Deploy frontend + backend together like `emea-sales-pod` demo:

**Requirements:**
- Docker container
- EC2 / ECS / Elastic Beanstalk
- server.js serves both static files AND proxy

**Pros:**
- Single deployment unit
- No API Gateway needed

**Cons:**
- Need to manage servers
- More expensive than Lambda

## Production Configuration

Update `config.js` for production:

```javascript
export const CONFIG = {
  // Use environment detection
  CLAUDE_API_PROXY:
    window.location.hostname === 'localhost'
      ? 'http://localhost:3001/api/claude'
      : 'https://your-api-id.execute-api.us-east-1.amazonaws.com/api/claude',

  // Remove API keys from frontend code!
  // CLAUDE_API_KEY: '',  // ← Move to Lambda environment variables

  // Keep public tokens
  MAPBOX_ACCESS_TOKEN: 'pk.eyJ1...',
  RURUBU_APP_ID: 'n2xNzqos7NirxGBJ',
};
```

## Cost Estimates (AWS Lambda)

**Lambda:**
- Free tier: 1M requests/month
- Memory: 256MB × 3 seconds = 768,000 GB-seconds/month free
- Beyond free tier: $0.20 per 1M requests

**API Gateway:**
- Free tier: 1M requests/month (first 12 months)
- Beyond: $1.00 per 1M requests

**S3 + CloudFront:**
- Static hosting: ~$1-5/month

**Example: 10,000 users/month**
- 50,000 requests
- **Cost: $0** (within free tier)

## Testing Gemini (Alternative AI Provider)

We discovered **Gemini has NO CORS restrictions**, but still needs backend for security:

```javascript
// config.js
AI_PROVIDER: 'gemini',  // Switch to Gemini
GEMINI_API_KEY: 'AIza...',  // Still needs backend for production!
```

**Comparison:**

| Feature | Claude | Gemini |
|---------|--------|--------|
| CORS Restriction | ❌ Yes | ✅ No |
| Backend Required | Security | Security |
| Local Dev | Need proxy | Direct API |
| Production | Need proxy | Need proxy |
| Capability | Excellent | Good |

**Recommendation:** Stick with Claude
- More capable for complex tasks
- Better tool use
- Already built and tested

## Security Checklist

Before deploying:

- [ ] Remove API keys from `config.js`
- [ ] API keys stored in Lambda environment variables
- [ ] Test Lambda function with production API key
- [ ] Configure CORS on API Gateway
- [ ] Restrict API Gateway CORS to your domain
- [ ] Enable API Gateway rate limiting
- [ ] Set up CloudWatch logging
- [ ] Test production build locally first
- [ ] Verify API keys NOT in bundled JS

## Deployment Commands

```bash
# Local development
npm run server          # Start proxy server
npm start              # Start frontend

# Or combined
npm run dev            # Both in parallel

# Production build
npm run build          # Builds to ./build directory

# Deploy Lambda
cd lambda
./deploy-lambda.sh

# Deploy frontend (to S3)
./deploy.sh            # Uploads ./build to S3
```

## Troubleshooting

### API key exposed in bundled JS
```bash
# Check if exposed
grep -r "sk-ant-" build/
grep -r "AIza" build/

# Should return nothing in production
```

### Lambda timeout
- Increase timeout in Lambda settings (max 15 min)
- Check CloudWatch logs

### CORS errors
- Verify API Gateway CORS configuration
- Check Lambda returns proper CORS headers

### Rate limiting
- Add API Gateway throttling
- Consider caching responses

## Next Steps

1. **Deploy Lambda function**
   - Follow `lambda/README.md`
   - Get API Gateway URL

2. **Update config.js**
   - Point to production Lambda URL
   - Remove sensitive keys

3. **Test production build locally**
   ```bash
   npm run build
   npm run serve
   ```

4. **Deploy to S3**
   ```bash
   ./deploy.sh
   ```

5. **Verify security**
   - Check no API keys in browser source
   - Test functionality end-to-end

## Support

- Lambda deployment: See `lambda/README.md`
- Architecture questions: Review this file
- Local development: `npm run dev`

---

**Built with ❤️ for Mapbox Demos**
