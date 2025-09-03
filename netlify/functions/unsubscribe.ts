import { createClient } from '@supabase/supabase-js'
import { Context } from '@netlify/functions'
import { NotificationConsentService } from '../../src/lib/notifications/consent-service'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables')
}

interface NetlifyEvent {
  httpMethod: string
  headers: Record<string, string>
  queryStringParameters?: Record<string, string>
  body: string
  path: string
}

export async function handler(event: NetlifyEvent, context: Context) {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  }

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    }
  }

  try {
    const consentService = new NotificationConsentService(supabaseUrl, supabaseServiceKey)
    
    // Extract token from URL path or query parameters
    const pathParts = event.path.split('/')
    const token = pathParts[pathParts.length - 1] || event.queryStringParameters?.token

    if (!token) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        body: generateUnsubscribePage({
          success: false,
          title: 'Invalid Link',
          message: 'This unsubscribe link is invalid or missing required information.',
          showForm: false
        })
      }
    }

    if (event.httpMethod === 'GET') {
      // Show unsubscribe confirmation page
      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        body: generateUnsubscribePage({
          success: null,
          title: 'Unsubscribe from Notifications',
          message: 'Are you sure you want to unsubscribe from our notifications?',
          showForm: true,
          token
        })
      }
    }

    if (event.httpMethod === 'POST') {
      // Process unsubscribe request
      const clientIp = event.headers['x-forwarded-for'] || 
                      event.headers['x-real-ip'] || 
                      context.clientContext?.ip

      const result = await consentService.processUnsubscribe(token, clientIp)

      return {
        statusCode: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        body: generateUnsubscribePage({
          success: result.success,
          title: result.success ? 'Unsubscribed Successfully' : 'Unsubscribe Failed',
          message: result.message,
          showForm: false,
          affectedChannels: result.affectedChannels
        })
      }
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    }

  } catch (error) {
    console.error('Unsubscribe error:', error)
    
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'text/html' },
      body: generateUnsubscribePage({
        success: false,
        title: 'Error',
        message: 'An error occurred while processing your request. Please try again later.',
        showForm: false
      })
    }
  }
}

interface UnsubscribePageOptions {
  success: boolean | null
  title: string
  message: string
  showForm: boolean
  token?: string
  affectedChannels?: string[]
}

function generateUnsubscribePage(options: UnsubscribePageOptions): string {
  const { success, title, message, showForm, token, affectedChannels } = options

  return `
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Schnittwerk Your Style</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f8f9fa;
            padding: 20px;
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        
        .content {
            padding: 30px;
        }
        
        .icon {
            font-size: 48px;
            margin-bottom: 20px;
            display: block;
        }
        
        .success { color: #10b981; }
        .error { color: #ef4444; }
        .info { color: #3b82f6; }
        
        h1 {
            margin-bottom: 10px;
            font-size: 24px;
        }
        
        p {
            margin-bottom: 20px;
            color: #666;
            font-size: 16px;
        }
        
        .form {
            text-align: center;
            margin: 30px 0;
        }
        
        .btn {
            display: inline-block;
            padding: 12px 30px;
            margin: 0 10px;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: 600;
            text-decoration: none;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .btn-danger {
            background: #ef4444;
            color: white;
        }
        
        .btn-danger:hover {
            background: #dc2626;
        }
        
        .btn-secondary {
            background: #6b7280;
            color: white;
        }
        
        .btn-secondary:hover {
            background: #4b5563;
        }
        
        .channels {
            background: #f3f4f6;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
        
        .channels h3 {
            margin-bottom: 10px;
            color: #374151;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .channel-list {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }
        
        .channel-tag {
            background: #e5e7eb;
            color: #374151;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 500;
        }
        
        .footer {
            background: #f8f9fa;
            padding: 20px 30px;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
            border-top: 1px solid #e5e7eb;
        }

        @media (max-width: 600px) {
            .container {
                margin: 0;
                border-radius: 0;
            }
            
            .header, .content {
                padding: 20px;
            }
            
            .btn {
                display: block;
                margin: 10px 0;
                width: 100%;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <span class="icon ${success === true ? 'success' : success === false ? 'error' : 'info'}">
                ${success === true ? '✓' : success === false ? '✗' : '📧'}
            </span>
            <h1>Schnittwerk Your Style</h1>
        </div>
        
        <div class="content">
            <h1>${title}</h1>
            <p>${message}</p>
            
            ${affectedChannels && affectedChannels.length > 0 ? `
                <div class="channels">
                    <h3>Betroffene Kanäle</h3>
                    <div class="channel-list">
                        ${affectedChannels.map(channel => 
                            `<span class="channel-tag">${channel === 'email' ? 'E-Mail' : 'SMS'}</span>`
                        ).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${showForm ? `
                <div class="form">
                    <form method="POST" action="">
                        <input type="hidden" name="token" value="${token}" />
                        <button type="submit" class="btn btn-danger">
                            Ja, abmelden
                        </button>
                        <a href="javascript:history.back()" class="btn btn-secondary">
                            Abbrechen
                        </a>
                    </form>
                </div>
            ` : ''}
            
            ${success === true ? `
                <p><strong>Was bedeutet das?</strong></p>
                <ul style="margin-left: 20px; color: #666;">
                    <li>Sie erhalten keine weiteren Benachrichtigungen an die abgemeldeten Kanäle</li>
                    <li>Ihre Terminbuchungen sind davon nicht betroffen</li>
                    <li>Sie können sich jederzeit wieder anmelden</li>
                </ul>
            ` : ''}
        </div>
        
        <div class="footer">
            <p>
                <strong>Schnittwerk Your Style</strong><br>
                Professioneller Friseursalon<br>
                <a href="mailto:info@schnittwerk-your-style.de" style="color: #3b82f6;">info@schnittwerk-your-style.de</a>
            </p>
        </div>
    </div>
</body>
</html>
  `.trim()
}