import { query } from './db';

interface Setting {
    key: string;
    value: string;
}

export interface TelegramConfig {
    enabled: boolean;
    botToken: string | null;
    chatId: string | null;
}

// Get Telegram configuration from database
export async function getTelegramConfig(): Promise<TelegramConfig> {
    const settings = await query<Setting>(
        `SELECT key, value FROM settings WHERE key LIKE 'telegram_%'`
    );

    const config: TelegramConfig = {
        enabled: false,
        botToken: null,
        chatId: null,
    };

    for (const setting of settings) {
        switch (setting.key) {
            case 'telegram_enabled':
                config.enabled = setting.value === 'true';
                break;
            case 'telegram_bot_token':
                config.botToken = setting.value;
                break;
            case 'telegram_chat_id':
                config.chatId = setting.value;
                break;
        }
    }

    return config;
}

// Get updates from Telegram bot to find chat_id
export async function getChatIdFromUpdates(botToken: string): Promise<{ success: boolean; chatId?: string; error?: string }> {
    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates`, {
            method: 'GET',
        });

        if (!response.ok) {
            const data = await response.json();
            return { success: false, error: data.description || 'Failed to get updates' };
        }

        const data = await response.json();
        
        if (!data.ok || !data.result || data.result.length === 0) {
            return { 
                success: false, 
                error: 'No messages found. Please send /start to your bot first, then try again.' 
            };
        }

        // Get the most recent message's chat_id
        const lastUpdate = data.result[data.result.length - 1];
        const chatId = lastUpdate.message?.chat?.id || lastUpdate.my_chat_member?.chat?.id;

        if (!chatId) {
            return { 
                success: false, 
                error: 'Could not find chat ID. Please send /start to your bot and try again.' 
            };
        }

        return { success: true, chatId: String(chatId) };
    } catch (error) {
        const err = error as Error;
        return { success: false, error: err.message };
    }
}

// Send a message via Telegram
export async function sendTelegramMessage(
    botToken: string, 
    chatId: string, 
    message: string,
    parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'HTML'
): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: parseMode,
                disable_web_page_preview: true,
            }),
        });

        const data = await response.json();

        if (!data.ok) {
            return { success: false, error: data.description || 'Failed to send message' };
        }

        return { success: true };
    } catch (error) {
        const err = error as Error;
        return { success: false, error: err.message };
    }
}

// Send a photo via Telegram
export async function sendTelegramPhoto(
    botToken: string,
    chatId: string,
    photoBuffer: Buffer,
    caption: string,
    parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'HTML'
): Promise<{ success: boolean; error?: string }> {
    try {
        const formData = new FormData();
        formData.append('chat_id', chatId);
        // Convert Buffer to Uint8Array for Blob compatibility
        const uint8Array = new Uint8Array(photoBuffer);
        formData.append('photo', new Blob([uint8Array], { type: 'image/png' }), 'screenshot.png');
        formData.append('caption', caption);
        formData.append('parse_mode', parseMode);

        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
            method: 'POST',
            body: formData,
        });

        const data = await response.json();

        if (!data.ok) {
            return { success: false, error: data.description || 'Failed to send photo' };
        }

        return { success: true };
    } catch (error) {
        const err = error as Error;
        return { success: false, error: err.message };
    }
}

// Send XSS report notification
export async function sendXSSNotification(reportData: {
    id: string;
    uri: string | null;
    origin: string | null;
    ip: string | null;
    userAgent: string | null;
    triggeredAt: string;
    screenshotBuffer?: Buffer | null;
}): Promise<void> {
    try {
        const config = await getTelegramConfig();
        
        if (!config.enabled || !config.botToken || !config.chatId) {
            return;
        }

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';
        const reportUrl = `${baseUrl}/reports/${reportData.id}`;

        const message = `🚨 <b>New XSS Report</b>

<b>ID:</b> <code>${reportData.id}</code>
<b>Origin:</b> ${reportData.origin || 'N/A'}
<b>URL:</b> ${reportData.uri || 'N/A'}
<b>IP:</b> ${reportData.ip || 'N/A'}
<b>Time:</b> ${new Date(reportData.triggeredAt).toLocaleString()}

<a href="${reportUrl}">View Report →</a>`;

        // If screenshot is available, send as photo with caption
        if (reportData.screenshotBuffer) {
            const result = await sendTelegramPhoto(config.botToken, config.chatId, reportData.screenshotBuffer, message);
            if (!result.success) {
                // Fallback to text message if photo fails
                console.error('[Telegram] Photo send failed, falling back to text:', result.error);
                await sendTelegramMessage(config.botToken, config.chatId, message);
            }
        } else {
            // No screenshot, send text message
            await sendTelegramMessage(config.botToken, config.chatId, message);
        }
    } catch (error) {
        console.error('[Telegram] Failed to send notification:', error);
    }
}

// Validate bot token format
export function isValidBotToken(token: string): boolean {
    // Bot token format: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz
    return /^\d+:[A-Za-z0-9_-]{35,}$/.test(token);
}

// Test bot token by calling getMe
export async function testBotToken(botToken: string): Promise<{ success: boolean; botName?: string; error?: string }> {
    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`, {
            method: 'GET',
        });

        const data = await response.json();

        if (!data.ok) {
            return { success: false, error: data.description || 'Invalid bot token' };
        }

        return { 
            success: true, 
            botName: data.result.username 
        };
    } catch (error) {
        const err = error as Error;
        return { success: false, error: err.message };
    }
}
