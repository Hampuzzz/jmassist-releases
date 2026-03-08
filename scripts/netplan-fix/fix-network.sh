#!/bin/bash
# Kör detta på Magicnuc efter att USB-stickan är monterad
# Usage: sudo bash /mnt/usb/netplan-fix/fix-network.sh

echo "Kopierar netplan-config..."
cp /mnt/usb/netplan-fix/50-cloud-init.yaml /etc/netplan/50-cloud-init.yaml
chmod 600 /etc/netplan/50-cloud-init.yaml

echo "Applicerar nätverksinställningar..."
netplan apply

echo "Väntar 5 sekunder..."
sleep 5

echo "Nätverksstatus:"
ip addr show eno1

echo ""
echo "Klart! Om du ser en inet-adress så funkar det."
