from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/api/generate', methods=['POST'])

def topology_code():

	code = "#!/usr/bin/env python3\n"
	code = code + "from mininet.net import Mininet\n"
	code = code + "from mininet.cli import CLI\n"
	code = code + "def make_network():\n"
	code = code + "    net = Mininet()\n"

	data = request.get_json()

	hosts, switches, links = [data.get(i, []) for i in ('hosts', 'switches', 'links')]
	type = data.get('mode', 'build')

	if type == 'build':

		for host in hosts:
			host_id = host.get('id', ' ')
			host_ip = host.get('ip', ' ')
			code = code + f"    {host_id} = net.addHost('{host_id}', ip = '{host_ip}')\n"
		
		for switch in switches:
			switch_id = switch.get('id', ' ')
			code = code + f"    {switch_id} = net.addSwitch('{switch_id}')\n"
