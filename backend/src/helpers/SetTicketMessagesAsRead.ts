import { proto, WASocket } from "@whiskeysockets/baileys";
import { cacheLayer } from "../libs/cache";
import { getIO } from "../libs/socket";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import { logger } from "../utils/logger";
import GetTicketWbot from "./GetTicketWbot";

const SetTicketMessagesAsRead = async (ticket: Ticket): Promise<void> => {
  await ticket.update({ unreadMessages: 0 });
  await cacheLayer.set(`contacts:${ticket.contactId}:unreads`, "0");
  let companyid;
  try {
    const wbot = await GetTicketWbot(ticket);

    const getJsonMessage = await Message.findAll({
      where: {
        ticketId: ticket.id,
        fromMe: false,
        read: false
      },
      order: [["createdAt", "DESC"]]
    });
     companyid = getJsonMessage[0]?.companyId;

    if (getJsonMessage.length > 0) {
      const lastMessages: proto.IWebMessageInfo = JSON.parse(
        JSON.stringify(getJsonMessage[0].dataJson)
      );
      const number = ticket.isGroup ? `${ticket.contact.number.substring(12,0)}-${ticket.contact.number.substring(12)}@g.us` : `${ticket.contact.number}@s.whatsapp.net`
      if (lastMessages.key && lastMessages.key.fromMe === false) {
        await (wbot as WASocket).chatModify(
          { markRead: true, lastMessages: [lastMessages] },
          number
          // `${ticket.contact.number}@${
          //   ticket.isGroup ? "g.us" : "s.whatsapp.net"
          // }`
        );
      }
    }

    await Message.update(
      { read: true },
      {
        where: {
          ticketId: ticket.id,
          read: false
        }
      }
    );
  } catch (err) {
    console.log(err);
    logger.warn(
      `Could not mark messages as read. Maybe whatsapp session disconnected? Err: ${err}`
    );
  }

  const io = getIO();
  if (companyid){
    io.emit(`company-${companyid}-ticket`, {
      action: "updateUnread",
      ticketId: ticket?.id
    });
  }

  io.to(ticket.status).to("notification").emit("ticket", {
    action: "updateUnread",
    ticketId: ticket.id
  });
};

export default SetTicketMessagesAsRead;
