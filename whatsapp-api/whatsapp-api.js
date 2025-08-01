// Load environment variables from .env
try {
  require('dotenv').config({ path: '../.env' });
} catch (e) {
  console.warn('dotenv not found; environment variables will not be loaded from .env');
}

const express = require('express');
const cors = require('cors');

/*
 * This API wraps the popular whatsapp‑web.js library into a RESTful service.
 *
 * The code defines a number of endpoints that mirror most of the features
 * supported by whatsapp‑web.js as of July 2025.  A single WhatsApp client
 * instance is bootstrapped using the `LocalAuth` authentication strategy so
 * sessions persist on disk.  When the client first starts it will emit a
 * `qr` event containing the QR‑code string that must be scanned by the
 * account owner.  That string is exposed through the `/qr` endpoint.
 *
 * Once the device is paired the API can send messages, media, stickers,
 * locations, polls, manage groups, handle channels and perform many other
 * actions.  The whatsapp‑web.js documentation describes the available
 * methods in detail – for example `MessageSendOptions` allows you to
 * specify captions, mentions and other options when sending messages【974646208843071†L1039-L1167】.  See the README or documentation for
 * additional examples.
 */

const { Client, LocalAuth, MessageMedia, Location, Poll } = require('whatsapp-web.js');

// Create the Express application and apply middlewares.
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Global variables to hold the WhatsApp client and the latest QR code.
let client;
let qrCode; // holds the most recent QR code string
let clientReady = false;

/*
 * Initialise the WhatsApp client.  If the client has already been
 * initialised this function will do nothing.  The LocalAuth strategy
 * persists the session to disk, so subsequent restarts will not require
 * scanning the QR code again【652435738499336†L31-L106】.  Note that running
 * Puppeteer without sandbox flags may cause issues on Linux; see the
 * documentation for details【652435738499336†L37-L49】.
 */
async function initClient() {
  if (client) return;
  client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });
  // Listen for QR code events and cache the latest code.  The code is
  // delivered as a string that needs to be converted into a QR code by
  // your client application.
  client.on('qr', (qr) => {
    qrCode = qr;
    clientReady = false;
  });
  // Update readiness when the client is authenticated and ready.
  client.on('ready', () => {
    clientReady = true;
  });
  client.on('authenticated', () => {
    clientReady = false;
  });
  client.on('auth_failure', () => {
    clientReady = false;
  });
  await client.initialize();
}

// Start the client immediately on launch.
initClient().catch((err) => console.error('Error initialising client', err));

// Healthcheck – returns status of the WhatsApp client.
app.get('/status', (_req, res) => {
  res.json({ ready: clientReady, qr: !!qrCode });
});

// Retrieve the current QR code.  Returns JSON with the raw string and a
// dataURL field.  Clients may convert the data string into an actual
// image on their end.
app.get('/qr', async (_req, res) => {
  // Refresh the client if not yet initialised
  if (!client) await initClient();
  if (!qrCode) {
    return res.status(404).json({ error: 'QR code not generated yet' });
  }
  // Generate a data URL using qrcode library at runtime.  If the
  // dependency is not installed then only return the raw string.  The
  // optional import avoids bundling the library when not needed.
  let dataUrl;
  try {
    const QRCode = require('qrcode');
    dataUrl = await QRCode.toDataURL(qrCode);
  } catch (e) {
    dataUrl = null;
  }
  res.json({ qr: qrCode, dataUrl });
});

/*
 * MESSAGE ROUTES
 */

// Send a plain text or location or media message to a chat.  The body
// should include a `chatId` and a `content`.  The optional `options`
// object accepts the same fields described in MessageSendOptions such
// as `caption`, `mentions`, `quotedMessageId`, `linkPreview`, etc【974646208843071†L1039-L1167】.
app.post('/messages/send', async (req, res) => {
  const { chatId, content, options = {} } = req.body;
  if (!chatId || content === undefined) {
    return res.status(400).json({ error: 'chatId and content are required' });
  }
  try {
    await initClient();
    const message = await client.sendMessage(chatId, content, options);
    res.json({ messageId: message.id ? message.id._serialized || message.id : null });
  } catch (err) {
    console.error('Error sending message', err);
    res.status(500).json({ error: err.message });
  }
});

// Send media (images, audio, video, documents) to a chat.  The body must
// include a `chatId`, `mimetype` and a base64 encoded `data`.  You may
// optionally provide a `filename`, a `caption` and other message options
// (e.g. sendMediaAsSticker, sendMediaAsDocument, sendMediaAsHd).  See
// documentation for details【610363071650698†L62-L85】【974646208843071†L1039-L1167】.
app.post('/messages/send-media', async (req, res) => {
  const { chatId, mimetype, data, filename = undefined, caption, options = {} } = req.body;
  if (!chatId || !mimetype || !data) {
    return res.status(400).json({ error: 'chatId, mimetype and data are required' });
  }
  try {
    await initClient();
    const media = new MessageMedia(mimetype, data, filename);
    const sendOptions = { ...options };
    if (caption) sendOptions.caption = caption;
    const message = await client.sendMessage(chatId, media, sendOptions);
    res.json({ messageId: message.id ? message.id._serialized || message.id : null });
  } catch (err) {
    console.error('Error sending media', err);
    res.status(500).json({ error: err.message });
  }
});

// Send a sticker.  A sticker is just a media message with the
// `sendMediaAsSticker` flag set to true.  Additional sticker metadata
// such as author, name or categories can be passed via the `options`
// field【974646208843071†L1077-L1201】.
app.post('/messages/send-sticker', async (req, res) => {
  const { chatId, mimetype, data, filename = undefined, stickerAuthor, stickerName, stickerCategories = [], options = {} } = req.body;
  if (!chatId || !mimetype || !data) {
    return res.status(400).json({ error: 'chatId, mimetype and data are required' });
  }
  try {
    await initClient();
    const media = new MessageMedia(mimetype, data, filename);
    const sendOptions = {
      sendMediaAsSticker: true,
      stickerAuthor,
      stickerName,
      stickerCategories,
      ...options,
    };
    const message = await client.sendMessage(chatId, media, sendOptions);
    res.json({ messageId: message.id ? message.id._serialized || message.id : null });
  } catch (err) {
    console.error('Error sending sticker', err);
    res.status(500).json({ error: err.message });
  }
});

// Send a location message.  The body must include a `chatId`, a
// `latitude` and `longitude`.  Optional fields `name` or `address` may
// also be provided【751717916004585†L26-L66】.
app.post('/messages/send-location', async (req, res) => {
  const { chatId, latitude, longitude, name, address, options = {} } = req.body;
  if (!chatId || typeof latitude !== 'number' || typeof longitude !== 'number') {
    return res.status(400).json({ error: 'chatId, latitude and longitude are required' });
  }
  try {
    await initClient();
    const location = new Location(latitude, longitude, { name, address });
    const message = await client.sendMessage(chatId, location, options);
    res.json({ messageId: message.id ? message.id._serialized || message.id : null });
  } catch (err) {
    console.error('Error sending location', err);
    res.status(500).json({ error: err.message });
  }
});

// Reply to an existing message.  Provide the `chatId`, the `content`
// (string/media/location) and the `quotedMessageId`.  The options
// object may include any MessageSendOptions values【974646208843071†L1039-L1167】.  Note that the
// quoted message must belong to the same chat.
app.post('/messages/reply', async (req, res) => {
  const { chatId, content, quotedMessageId, options = {} } = req.body;
  if (!chatId || !quotedMessageId || content === undefined) {
    return res.status(400).json({ error: 'chatId, content and quotedMessageId are required' });
  }
  try {
    await initClient();
    const opts = { ...options, quotedMessageId };
    const message = await client.sendMessage(chatId, content, opts);
    res.json({ messageId: message.id ? message.id._serialized || message.id : null });
  } catch (err) {
    console.error('Error replying to message', err);
    res.status(500).json({ error: err.message });
  }
});

// React to a message with an emoji.  Provide a `messageId` and an
// `emoji`.  This method fetches the message from its chat and then
// calls the `react` method【929946613906590†L466-L481】.
app.post('/messages/react', async (req, res) => {
  const { chatId, messageId, emoji } = req.body;
  if (!chatId || !messageId || !emoji) {
    return res.status(400).json({ error: 'chatId, messageId and emoji are required' });
  }
  try {
    await initClient();
    const chat = await client.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit: 50 });
    const message = messages.find(m => m.id && (m.id._serialized || m.id) === messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found in recent history' });
    }
    await message.react(emoji);
    res.json({ success: true });
  } catch (err) {
    console.error('Error reacting to message', err);
    res.status(500).json({ error: err.message });
  }
});

// Fetch messages from a chat.  Accepts a `limit` query parameter
// controlling how many messages to return; defaults to 20.  Messages
// are returned from earliest to latest【856836306588510†L290-L310】.  Note that there may be
// fewer available messages than requested【856836306588510†L290-L310】.
app.get('/messages/:chatId', async (req, res) => {
  const { chatId } = req.params;
  const limit = parseInt(req.query.limit, 10) || 20;
  try {
    await initClient();
    const chat = await client.getChatById(chatId);
    const messages = await chat.fetchMessages({ limit });
    res.json(messages.map((msg) => ({
      id: msg.id?._serialized || msg.id,
      body: msg.body,
      fromMe: msg.fromMe,
      timestamp: msg.timestamp,
      type: msg.type,
    })));
  } catch (err) {
    console.error('Error fetching messages', err);
    res.status(500).json({ error: err.message });
  }
});

/*
 * GROUP ROUTES
 */

// Create a new group.  Provide a `title` and an array of `participants`.
// An optional `options` object can include subject and description.
app.post('/groups', async (req, res) => {
  const { title, participants = [], options = {} } = req.body;
  if (!title || !Array.isArray(participants)) {
    return res.status(400).json({ error: 'title and participants array are required' });
  }
  try {
    await initClient();
    const result = await client.createGroup(title, participants, options);
    res.json(result);
  } catch (err) {
    console.error('Error creating group', err);
    res.status(500).json({ error: err.message });
  }
});

// Get group invite code for a group chat.
app.get('/groups/:groupId/invite-code', async (req, res) => {
  const { groupId } = req.params;
  try {
    await initClient();
    const chat = await client.getChatById(groupId);
    if (!chat.isGroup) return res.status(400).json({ error: 'Not a group chat' });
    const code = await chat.getInviteCode();
    res.json({ code });
  } catch (err) {
    console.error('Error getting invite code', err);
    res.status(500).json({ error: err.message });
  }
});

// Join a group by its invite code.
app.post('/groups/join', async (req, res) => {
  const { inviteCode } = req.body;
  if (!inviteCode) {
    return res.status(400).json({ error: 'inviteCode is required' });
  }
  try {
    await initClient();
    const result = await client.acceptInvite(inviteCode);
    res.json(result);
  } catch (err) {
    console.error('Error joining group', err);
    res.status(500).json({ error: err.message });
  }
});

// Modify group subject.
app.post('/groups/:groupId/subject', async (req, res) => {
  const { groupId } = req.params;
  const { subject } = req.body;
  if (!subject) return res.status(400).json({ error: 'subject is required' });
  try {
    await initClient();
    const chat = await client.getChatById(groupId);
    if (!chat.isGroup) return res.status(400).json({ error: 'Not a group chat' });
    await chat.setSubject(subject);
    res.json({ success: true });
  } catch (err) {
    console.error('Error setting group subject', err);
    res.status(500).json({ error: err.message });
  }
});

// Modify group description.
app.post('/groups/:groupId/description', async (req, res) => {
  const { groupId } = req.params;
  const { description } = req.body;
  if (!description) return res.status(400).json({ error: 'description is required' });
  try {
    await initClient();
    const chat = await client.getChatById(groupId);
    if (!chat.isGroup) return res.status(400).json({ error: 'Not a group chat' });
    await chat.setDescription(description);
    res.json({ success: true });
  } catch (err) {
    console.error('Error setting group description', err);
    res.status(500).json({ error: err.message });
  }
});

// Add participants to a group.
app.post('/groups/:groupId/add-participants', async (req, res) => {
  const { groupId } = req.params;
  const { participantIds = [], options = {} } = req.body;
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    return res.status(400).json({ error: 'participantIds must be a non-empty array' });
  }
  try {
    await initClient();
    const chat = await client.getChatById(groupId);
    if (!chat.isGroup) return res.status(400).json({ error: 'Not a group chat' });
    const result = await chat.addParticipants(participantIds, options);
    res.json(result);
  } catch (err) {
    console.error('Error adding participants', err);
    res.status(500).json({ error: err.message });
  }
});

// Remove participants from a group.
app.post('/groups/:groupId/remove-participants', async (req, res) => {
  const { groupId } = req.params;
  const { participantIds = [] } = req.body;
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    return res.status(400).json({ error: 'participantIds must be a non-empty array' });
  }
  try {
    await initClient();
    const chat = await client.getChatById(groupId);
    if (!chat.isGroup) return res.status(400).json({ error: 'Not a group chat' });
    const result = await chat.removeParticipants(participantIds);
    res.json(result);
  } catch (err) {
    console.error('Error removing participants', err);
    res.status(500).json({ error: err.message });
  }
});

// Promote participants to admin.
app.post('/groups/:groupId/promote-participants', async (req, res) => {
  const { groupId } = req.params;
  const { participantIds = [] } = req.body;
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    return res.status(400).json({ error: 'participantIds must be a non-empty array' });
  }
  try {
    await initClient();
    const chat = await client.getChatById(groupId);
    if (!chat.isGroup) return res.status(400).json({ error: 'Not a group chat' });
    const result = await chat.promoteParticipants(participantIds);
    res.json(result);
  } catch (err) {
    console.error('Error promoting participants', err);
    res.status(500).json({ error: err.message });
  }
});

// Demote participants from admin.
app.post('/groups/:groupId/demote-participants', async (req, res) => {
  const { groupId } = req.params;
  const { participantIds = [] } = req.body;
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    return res.status(400).json({ error: 'participantIds must be a non-empty array' });
  }
  try {
    await initClient();
    const chat = await client.getChatById(groupId);
    if (!chat.isGroup) return res.status(400).json({ error: 'Not a group chat' });
    const result = await chat.demoteParticipants(participantIds);
    res.json(result);
  } catch (err) {
    console.error('Error demoting participants', err);
    res.status(500).json({ error: err.message });
  }
});

/*
 * CHAT ROUTES
 */

// Mute a chat.  Optionally supply `duration` in milliseconds for how
// long the chat should remain muted.  Without a duration the chat
// remains muted indefinitely【856836306588510†L255-L273】.
app.post('/chats/:chatId/mute', async (req, res) => {
  const { chatId } = req.params;
  const { duration } = req.body;
  try {
    await initClient();
    const chat = await client.getChatById(chatId);
    let unmuteDate = null;
    if (duration && typeof duration === 'number') {
      unmuteDate = new Date(Date.now() + duration);
    }
    const result = await chat.mute(unmuteDate);
    res.json(result);
  } catch (err) {
    console.error('Error muting chat', err);
    res.status(500).json({ error: err.message });
  }
});

// Unmute a chat.
app.post('/chats/:chatId/unmute', async (req, res) => {
  const { chatId } = req.params;
  try {
    await initClient();
    const chat = await client.getChatById(chatId);
    const result = await chat.unmute();
    res.json(result);
  } catch (err) {
    console.error('Error unmuting chat', err);
    res.status(500).json({ error: err.message });
  }
});

/*
 * CONTACT ROUTES
 */

// Get all contacts.
app.get('/contacts', async (_req, res) => {
  try {
    await initClient();
    const contacts = await client.getContacts();
    res.json(contacts.map(contact => ({
      id: contact.id?._serialized || contact.id,
      name: contact.name,
      number: contact.number,
      pushname: contact.pushname,
      isBusiness: contact.isBusiness,
      isBlocked: contact.isBlocked,
    })));
  } catch (err) {
    console.error('Error fetching contacts', err);
    res.status(500).json({ error: err.message });
  }
});

// Get information about a specific contact.
app.get('/contacts/:contactId', async (req, res) => {
  const { contactId } = req.params;
  try {
    await initClient();
    const contact = await client.getContactById(contactId);
    res.json({
      id: contact.id?._serialized || contact.id,
      name: contact.name,
      number: contact.number,
      pushname: contact.pushname,
      isBusiness: contact.isBusiness,
      isBlocked: contact.isBlocked,
      isUser: contact.isUser,
      isGroup: contact.isGroup,
    });
  } catch (err) {
    console.error('Error fetching contact', err);
    res.status(500).json({ error: err.message });
  }
});

// Get a contact's profile picture URL.
app.get('/contacts/:contactId/profile-picture', async (req, res) => {
  const { contactId } = req.params;
  try {
    await initClient();
    const url = await client.getProfilePicUrl(contactId);
    res.json({ url });
  } catch (err) {
    console.error('Error fetching profile picture', err);
    res.status(500).json({ error: err.message });
  }
});

// Block a contact.
app.post('/contacts/:contactId/block', async (req, res) => {
  const { contactId } = req.params;
  try {
    await initClient();
    const contact = await client.getContactById(contactId);
    const result = await contact.block();
    res.json({ result });
  } catch (err) {
    console.error('Error blocking contact', err);
    res.status(500).json({ error: err.message });
  }
});

// Unblock a contact.
app.post('/contacts/:contactId/unblock', async (req, res) => {
  const { contactId } = req.params;
  try {
    await initClient();
    const contact = await client.getContactById(contactId);
    const result = await contact.unblock();
    res.json({ result });
  } catch (err) {
    console.error('Error unblocking contact', err);
    res.status(500).json({ error: err.message });
  }
});

/*
 * STATUS ROUTES
 */

// Set the user's status message.  Provide the `status` property in the
// request body.  According to the documentation you can update your
// "about" (status) line using client.setStatus()【825061151452844†L122-L127】.
app.post('/me/status', async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status is required' });
  try {
    await initClient();
    await client.setStatus(status);
    res.json({ success: true });
  } catch (err) {
    console.error('Error setting status', err);
    res.status(500).json({ error: err.message });
  }
});

// Set the display name (nickname) for the user.  Provide a `displayName`.
app.post('/me/display-name', async (req, res) => {
  const { displayName } = req.body;
  if (!displayName) return res.status(400).json({ error: 'displayName is required' });
  try {
    await initClient();
    await client.setDisplayName(displayName);
    res.json({ success: true });
  } catch (err) {
    console.error('Error setting display name', err);
    res.status(500).json({ error: err.message });
  }
});

/*
 * POLL ROUTES
 */

// Create a poll and send it to a chat.  Provide a `chatId`, a
// `question` (pollName) and an array of `options`.  Optionally set
// `allowMultipleAnswers` (default false)【974646208843071†L1293-L1310】.
app.post('/polls', async (req, res) => {
  const { chatId, question, options = [], allowMultipleAnswers = false, extraOptions = {} } = req.body;
  if (!chatId || !question || !Array.isArray(options) || options.length === 0) {
    return res.status(400).json({ error: 'chatId, question and non-empty options array are required' });
  }
  try {
    await initClient();
    // Poll options require an array of objects with `name` and a unique
    // localId for each option.  localId can be any integer starting at 0.
    const pollOptions = options.map((name, index) => ({ name, localId: index }));
    const poll = new Poll(question, pollOptions, { allowMultipleAnswers, ...extraOptions });
    const message = await client.sendMessage(chatId, poll);
    res.json({ messageId: message.id ? message.id._serialized || message.id : null });
  } catch (err) {
    console.error('Error creating poll', err);
    res.status(500).json({ error: err.message });
  }
});

/*
 * CHANNEL ROUTES
 */

// Create a new channel.  Provide a `title` and an optional
// options object (see CreateChannelOptions in the docs).  Channels
// behave similarly to groups but allow broadcast‑like behaviour.
app.post('/channels', async (req, res) => {
  const { title, options = {} } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  try {
    await initClient();
    const result = await client.createChannel(title, options);
    res.json(result);
  } catch (err) {
    console.error('Error creating channel', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all channels.
app.get('/channels', async (_req, res) => {
  try {
    await initClient();
    const channels = await client.getChannels();
    res.json(channels);
  } catch (err) {
    console.error('Error fetching channels', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a channel.
app.delete('/channels/:channelId', async (req, res) => {
  const { channelId } = req.params;
  try {
    await initClient();
    const result = await client.deleteChannel(channelId);
    res.json(result);
  } catch (err) {
    console.error('Error deleting channel', err);
    res.status(500).json({ error: err.message });
  }
});

// Subscribe to a channel.  This will allow the user to receive
// messages from the channel.  Accepts an optional options object
// (see documentation for UnsubscribeOptions).
app.post('/channels/:channelId/subscribe', async (req, res) => {
  const { channelId } = req.params;
  const { options = {} } = req.body;
  try {
    await initClient();
    const result = await client.subscribeToChannel(channelId);
    res.json(result);
  } catch (err) {
    console.error('Error subscribing to channel', err);
    res.status(500).json({ error: err.message });
  }
});

// Unsubscribe from a channel.
app.post('/channels/:channelId/unsubscribe', async (req, res) => {
  const { channelId } = req.params;
  const { options = {} } = req.body;
  try {
    await initClient();
    const result = await client.unsubscribeFromChannel(channelId, options);
    res.json(result);
  } catch (err) {
    console.error('Error unsubscribing from channel', err);
    res.status(500).json({ error: err.message });
  }
});

// Send a message to a channel.  Provide `channelId`, `content` and
// optional `options` (see MessageSendOptions)【974646208843071†L1039-L1167】.
app.post('/channels/:channelId/send', async (req, res) => {
  const { channelId } = req.params;
  const { content, options = {} } = req.body;
  if (!content) return res.status(400).json({ error: 'content is required' });
  try {
    await initClient();
    const message = await client.sendMessage(channelId, content, options);
    res.json({ messageId: message.id ? message.id._serialized || message.id : null });
  } catch (err) {
    console.error('Error sending channel message', err);
    res.status(500).json({ error: err.message });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`WhatsApp API server running on http://localhost:${PORT}`);
});