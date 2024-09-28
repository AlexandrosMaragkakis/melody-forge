import time

from pythonosc import udp_client
from pythonosc import osc_message_builder

if __name__ == "__main__":
    sender = udp_client.SimpleUDPClient('127.0.0.1', 4560)
    sender.send_message('/trigger/piano', [60])


""" for sonic-pi real time coding:
live_loop :foo do
  use_real_time
  n = sync "/osc*/trigger/piano"
  play n[0]
end

"""
