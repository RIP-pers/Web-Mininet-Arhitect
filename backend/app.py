from flask import Flask, request, jsonify
from flask_cors import CORS
import networkx as nx

app = Flask(__name__)
CORS(app)

@app.route('/api/generate', methods=['POST'])
def topology_code():
	data = request.get_json()

	hosts = data.get('hosts', [])
	switches = data.get('switches', [])
	links = data.get('links', [])
	mode_type = data.get('mode', 'build')

	if mode_type == 'build':
		response_data = build_code(hosts, switches, links)
	elif mode_type == 'rewire':
		start = data.get('start_node')
		end = data.get('end_node')
		response_data = rewire_code(hosts, switches, links, start, end)
	else:
		return jsonify({'error': 'Invalid mode'})

	return jsonify(response_data)

def build_code(hosts, switches, links):

	code = [
		"#!/usr/bin/env python3",
		"from mininet.net import Mininet",
		"from mininet.cli import CLI",
		"from mininet.log import setLogLevel",
		"from mininet.link import TCLink",
		"def make_network():",
		"    net = Mininet(link=TCLink)"
	]

	for host in hosts:
		host_id = host.get('id', ' ')
		host_ip = host.get('ip', ' ')
		code.append(f"    {host_id} = net.addHost('{host_id}', ip = '{host_ip}')")

	code.append("")

	for switch in switches:
		switch_id = switch.get('id', ' ')
		code.append(f"    {switch_id} = net.addSwitch('{switch_id}')")

	code.append("")

	for link in links:
		src = link.get('source')
		dst = link.get('target')
		cost = link.get('weight', 10)
		code.append(f"    net.addLink({src}, {dst}, delay='{cost}ms')")

	code.append("")

	code.extend([
		"    net.start()",
		"    CLI(net)",
		"    net.stop()",
		"",
		"if __name__ == '__main__':",
		"    setLogLevel('info')",
		"    make_network()"
	])

	return "\n".join(code)

def rewire_code(hosts, switches, links, start, end):
	active_links = [link for link in links if link.get('active', True)]

	g = nx.Graph()

	for host in hosts:
		g.add_node(host.get('id'))
	for switch in switches:
		g.add_node(switch.get('id'))

	for link in active_links:
		src = link.get('source')
		dst = link.get('target')
		cost = link.get('weight', 10)

		if src and dst:
			g.add_edge(src, dst, weight=cost)

	try:
		new_route = nx.shortest_path(g, source=start, target=end, weight='weight')

		return {
			"status": "success",
			"path": new_route
		}
	except nx.NetworkXNoPath:
		return {
			"status": "error",
			"message": f"Nu exista cai disponibile intre {end} si {start}."
		}

if __name__ == '__main__':
	app.run(debug=True, port=5000)
	