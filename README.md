# b9k
An implementation of r9k (or robot9000, whatever you prefer) in a Discord bot.
## What is r9k?
r9k (robot9000, signal, whatever) is an IRC bot designed by xkcd for keeping conversations original - as in, any repetitive messages like "hi", "yeah", "lmao" etc. are blocked and punished for. I highly recommend you read [the original article](https://blog.xkcd.com/2008/01/14/robot9000-and-xkcd-signal-attacking-noise-in-chat/) for more details.
## How to use
**If you want a bot that you can invite and use out of the box...**<br>
You can't. Yet.<hr>
**If you want to selfhost this bot...**<br>
1. Clone this repository:
```
git clone https://github.com/notsuu/b9k
```
2. Make sure you have [node.js](https://nodejs.org/) (16.9.0 or newer), and install the required dependencies:
```
npm i
```
3. Create a Discord bot account, if you haven't already:
  - [Create a new application](https://discord.com/developers/applications?new_application=true)
  - Go to the `Bot` tab, create a bot account if it wasn't automatically created for you, and enable the `Message Content` intent. You may also want to disable the `Public Bot` setting.
  - Now go to the `OAuth2 > URL Generator` tab, select the `bot` scope, and enable the following permissions:
    - `Send Messages`
    - `Send Messages in Threads`
    - `Manage Messages`
    - `Embed Links`
    - `Read Message History`
    Copy the generated link and use it to invite the bot to your server.
4. Reset the bot's token and copy it. In the bot folder, create a file named `.env` and paste the following line in it:
  ```
  TOKEN=bot_token_here
  ```
5. With the bot invited, update the `config.json` file as desired (see [Configuration](README.md#Configuration))
6. Start the bot by running
  ```
  node .
  ```
## Commands
b9k comes with a few commands to streamline usage. All of them, excluding `!stats`, are staff-only (the user must have the `Manage Server` permission).
### `!add`
Adds the channel this command is ran in to the watchlist, meaning it'll be monitored for originality
### `!remove`
Opposite of [`!add`](README.md#add) - removes the channel from the watchlist. Be aware, however, that this will also clear the list of messages marked as original.
### `!watchlist`
View a list of monitored channels, and how much original messages have been recorded in them.
### `!stats`
Allows you to view your personal statistics, including:
- Amount of original and unoriginal messages you've sent
- Whether or not you're currently muted, and how long until the mute expires/decays
- How long your mute is/was, how long itll be next time and after it decays
### `!lom`
Switches LOM on/off. See [What is LOM?](README.md#what-is-lom) for details.
### `!eval`
Evaluates JavaScript code - as this is highly dangerous, you must specify who can run this command in your config - see [Configuration](README.md#Configuration) for details.
You can also use this update configuration on the fly, for example
```
updateConfig('prefix="?"')
```
would set the command prefix to `?`.
### `!clear`
Clears *all* server data without confirmation. Requires user to have [`!eval`](README.md#eval) access to run.
## Configuration
Most aspects of the bot can be configured using the `config.json` file. Here they are, as follows:
### `prefix` (`string`)
What prefix to use for commands.
### `originalityThreshold` (`number`)
Threshold for message originality score when using LOM, dropping below which marks the message as unoriginal.
### `initialMutePeriod` (`number`)
The shortest mute duration the user can get, in seconds.
### `muteMultiplier` (`number`)
Affects duration multiplication with consecutive mutes (`duration * multiplier`).
### `muteDecayMultiplier` (`number`)
Affects how much the mute duration decays (`duration / multiplier`).
### `decayTime` (`number`)
Base decay time, in seconds. The actual time is determined by taking the current mute period * 2 and the base time, and picking whichever is greater.
### `ignoreStaff` (`boolean`)
Whether or not should the bot ignore users with staff permissions.
### `allowAttachments` (`boolean`)
Whether or not should the bot ignore messages that have attachments, but no text content.
### `filterList` (`boolean[]`)
List of things the bot should ignore when filtering messages.
### `evalAccess` (`string[]`)
List of user ID's that can access the [`!eval`](README.md#eval) and [`!clear`](README.md#clear) commands. These must be in string format:
```diff
+ "evalAccess": ["123456789012345678"]
- "evalAccess": [123456789012345678]
```
## What is LOM?
LOM stands for Levenshtein Originality Metric, a totally real name btw. It works by taking the user's message, and running the following algorithm against every registered original message:
1. Calculate Levenshtein distance of new and original messages
2. Get score by dividing distance by length of original message
3. If score is below originality threshold, halt loop and deem message as unoriginal
4. If loop completes without halting, message is original
This allows the bot to detect small edits to original messages as unoriginal, something the basic 'hash message, check if its already in hash list' algorithm could not do.
## License
Licensed under the [MIT license](LICENSE) or something, idk
