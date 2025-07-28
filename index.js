import { after, instead, unpatchAll } from "@vendetta/patcher";
import { findByProps, getByProps } from "@vendetta/metro";
import { open as openToast } from "@vendetta/modules/common/Toasts";
import { getIDByName } from "@vendetta/assets";
import { sendMessage } from "@vendetta/modules/common/Messages";

let unpatches = [];

export default {
  manifest: {
    name: "FakeStickerFixed",
    version: "1.1.3",
    description: "Allows you to send stickers without Nitro. Fixed by octet-steam.",
    authors: [
      { name: "mafu", id: "519760564755365888" },
      { name: "octet-steam", id: "263530950070239235" }
    ],
  },

  onLoad() {
    const Constants = getByProps("Permissions");
    const Toasts = { open: openToast };

    const ic_clock = getIDByName("ic_clock");
    const Small = getIDByName("Small");

    const stickerUtils = findByProps("isSendableSticker", "getStickerSendability");
    const stickerGetters = findByProps("getPremiumPacks", "getAllGuildStickers", "getStickerById");
    const channelUtils = findByProps("getChannel");
    const messageSenders = findByProps("sendMessage", "sendStickers");
    const permissions = findByProps("getChannelPermissions");

    const customStickerPerm = getByProps("canUseCustomStickersEverywhere", { defaultExport: false });
    if (customStickerPerm?.default) {
      instead(customStickerPerm, "canUseCustomStickersEverywhere", () => true);
    }

    instead(stickerUtils, "getStickerSendability", () => 0);
    after(stickerUtils, "isSendableSticker", () => true);

    unpatches.push(instead(messageSenders, "sendStickers", async function(channelId, stickerIds) {
      const channel = channelUtils.getChannel(channelId);
      const sticker = stickerGetters.getStickerById(stickerIds[0]);

      if (channel.guild_id === sticker.guild_id) {
        return messageSenders.sendStickers.apply(this, arguments);
      }

      if (channel.guild_id && !permissions.can(Constants.Permissions.EMBED_LINKS, channel)) {
        Toasts.open({ content: "Embed Link is disabled in this channel", source: Small });
        return;
      }

      const stickerUrl = `https://media.discordapp.net/stickers/${sticker.id}.png`;

      switch (sticker.format_type) {
        case 1:
          return sendMessage(channel.id, { content: `${stickerUrl}?size=160` });
        case 2:
          // You can omit APNG to GIF conversion for now for simplicity
          return sendMessage(channel.id, { content: stickerUrl });
        case 3:
          return sendMessage(channel.id, {
            content: `https://raw.githubusercontent.com/m4fn3/RawStickers/master/${sticker.pack_id}/${sticker.id}.gif`,
          });
      }
    }));
  },

  onUnload() {
    unpatches.forEach((fn) => fn());
    unpatchAll();
  },
};