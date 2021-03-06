import play from '../tools/play'
import checkPremium from '../tools/checkPremium'

export default async function(options, message, voiceChannel, newArray) {
  const serverQueue = options.queue.get(message.guild.id)

  if (!serverQueue) {
    if (newArray.length > 200) {
      const premium = await checkPremium(message, "ваш сервер не имеет **Премиума**, поэтому очередь сокращена до 200. Подробности: `-vdonate`")

      if (!premium) {
        newArray.length = 200
      }
    }

    const queueContruct = {
      textChannel: message.channel,
      loopType: 0,
      loopSongs: [],
      songs: []
    }

    options.queue.set(message.guild.id, queueContruct)

    queueContruct.songs = [...queueContruct.songs, ...newArray]

    try {
      const node = options.shoukaku.getNode()
      console.log(options.shoukaku.getPlayer(message.guild.id))
      if (!options.shoukaku.getPlayer(message.guild.id)) {
        const player = await node.joinVoiceChannel({
          guildID: message.guild.id,
          voiceChannelID: voiceChannel.id,
          deaf: true
        })

        player.on("closed", reason => {
          console.log(reason)
          options.queue.delete(message.guild.id)
          player.disconnect()
          if (serverQueue)
            if (serverQueue.pauseTimer)
              clearTimeout(serverQueue.pauseTimer)

          console.log(`${message.guild.shardID}/${message.guild.id} бот отключился от канала`)
        })
  
        player.on("error", () => {
          options.queue.delete(message.guild.id)
          player.disconnect()
          console.log(`${message.guild.shardID}/${message.guild.id} ошибка плеера`)
        })
  
        player.on("end", () => {
          console.log(`${message.guild.shardID}/${message.guild.id} трек закончился`)
          const serverQueue = options.queue.get(message.guild.id)
          serverQueue.songs.shift()
          play(message.guild, serverQueue.songs[0], options)
        })
      }

      play(message.guild, queueContruct.songs[0], options)
    } catch (err) {
      console.log(err)
      message.reply("ошибка. Попробуйте сменить регион сервера.")
      options.queue.delete(message.guild.id)
    }
  } else {
    let arr = [...serverQueue.songs, ...newArray]
    if (arr.length > 200) {
      const premium = await checkPremium(message, "ваш сервер не имеет **Премиума**, поэтому очередь сокращена до 200. Подробности: `-vdonate`")

      if (!premium) {
        arr.length = 200
      }
    }

    serverQueue.songs = arr
  }
}