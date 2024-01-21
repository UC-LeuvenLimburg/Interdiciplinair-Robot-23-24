var app = new Vue({
  el: '#app',
  data: {
    connected: false,
    ros: null,
    cmdVel: null,
    twistTopic: null,
    topic: null,
    message: null,
    VectorMessage: null,
    receivedMessages: [],
    selectedAddress: null,
    availableTopics: [],
    selectedTopic: '',
    topicMessageTypes: {},
    data: null,
    mytopic: null,
    camera_topic: null,
    x: 0,
    y: 0,
    z: 0,
    batteryLevel: -1,
    batteryTopicName: "/Battery",
    cameraTopicName: "/image_raw/compressed",
    intervals: {},
  },

  created: function () {
    this.changeWsAddress();
  },

  methods: {
    //functie om een lijst van topics op te halen
    fetchTopics: function () {
      const topicRequest = new ROSLIB.ServiceRequest();

      const service = new ROSLIB.Service({
        ros: this.ros,
        name: '/rosapi/topics',
        serviceType: 'rosapi/Topics',
      });

      service.callService(topicRequest, (result) => {
        this.availableTopics = result.topics;
        console.log(result.topics);

        this.availableTopics.forEach((topic) => {
          this.fetchMessageType(topic);
        });
      });
    },

    setupTwistTopic: function () {
      this.twistTopic = new ROSLIB.Topic({
        ros: this.ros,
        name: '/turtle1/cmd_vel',
        messageType: 'geometry_msgs/Twist'
      });
    },

    publishTwist: function (valuex, valuez) {
      if (this.twistTopic) {
        var twistMessage = new ROSLIB.Message({
          linear: {
            x: parseFloat(valuex),
            y: parseFloat(0),
            z: parseFloat(0)
          }
          ,
          angular: {
            x: parseFloat(0),
            y: parseFloat(0),
            z: parseFloat(valuez)
          }
        });

        // Publish the Twist message
        this.twistTopic.publish(twistMessage);
      } else {
        console.error('Twist topic not initialized');
      }
    },

    buttonClicked: function (direction) {
      this.intervals[direction] = setInterval(() => {
        switch (direction) {
          case "up":
            this.publishTwist(2, 0.0)
            break;
          case "down":
            this.publishTwist(-2, 0.0)
            break;
          case "right":
            this.publishTwist(0.0, -2)
            break;
          case "left":
            this.publishTwist(0.0, 2)
            break;
          default:
            console.log("Unknown direction");
        }
      }, 50);
      console.log(`set variable: ${direction}`);
    },
    
    buttonReleased: function (direction) {
      clearInterval(this.intervals[direction]);
    },

    //functie om voor elke topic te achterhalen wat de message type is
    fetchMessageType: function (topic) {
      const messageTypeRequest = new ROSLIB.ServiceRequest({
        topic: topic,
      });

      const service = new ROSLIB.Service({
        ros: this.ros,
        name: '/rosapi/topic_type',
        serviceType: 'rosapi/TopicType',
      });

      service.callService(messageTypeRequest, (result) => {
        // Store the message type for the topic
        this.$set(this.topicMessageTypes, topic, result.type);
        // console.log(result.type)
      });
    },

    // functie die subscribed naar de topic jij kiest van de lijst
    subscribeToTopic: function () {
      // Unsubscribe from the current topic (if any)
      if (this.topic != this.mytopic && this.mytopic != null) {
        this.mytopic.unsubscribe();
      }

      // Subscribe to the selected topic
      this.mytopic = new ROSLIB.Topic({
        ros: this.ros,
        name: this.selectedTopic,
        messageType: this.topicMessageTypes[this.selectedTopic],
      });

      this.mytopic.subscribe((message) => {
        // Handle different message types
        if (this.selectedTopic === '/turtle1/cmd_vel') {
          const data = { x: message.linear.x, y: message.linear.y, z: message.angular.z };
          this.receivedMessages.unshift(data);
        } else {
          // Handle other message types accordingly
          this.receivedMessages.unshift(message.data);
        }
        console.log(this.receivedMessages);
      });
    },

    disconnect: function () {
      this.ros.close();
    },

    clearReceivedMessages: function () {
      this.receivedMessages = [];
    },

    setTopic: function () {
      this.topic = new ROSLIB.Topic({
        ros: this.ros,
        name: '/Led',
        messageType: 'std_msgs/Int32'
      })
    },

    setTopicc: function () {
      this.topic = new ROSLIB.Topic({
        ros: this.ros,
        name: '/Pointie',
        messageType: 'geometry_msgs/Point'
      })
    },

    subToTopicBattery: function () {
      battery_topic = new ROSLIB.Topic({
        ros: this.ros,
        name: this.batteryTopicName,
        messageType: "std_msgs/msg/Float64",
      });

      battery_topic.subscribe((message) => {
        this.batteryLevel = message.data * 100;
        document.getElementById("BatteryLevel").textContent = convertToPercentage;
      });
    },

    subToTopicCamera: function () {
      camera_topic = new ROSLIB.Topic({
        ros: this.ros,
        name: this.cameraTopicName,
        messageType: "sensor_msgs/msg/CompressedImage",
      });

      camera_topic.subscribe((message) => {
        document.getElementById("myimage").src = "data:image/jpg;base64," + message.data;
      });
    },

    ledAan: function () {
      this.message = new ROSLIB.Message({
        data: 1,
      });
      this.setTopic();
      document.getElementById("publishLog").innerHTML += JSON.stringify(this.message) + "<br>";
      this.topic.publish(this.message);
    },

    ledUit: function () {
      this.message = new ROSLIB.Message({
        data: 0
      });
      this.setTopic();
      document.getElementById("publishLog").innerHTML += JSON.stringify(this.message) + "<br>";
      this.topic.publish(this.message);
    },

    sendValue: function () {
      this.message = new ROSLIB.Message({
        x: parseFloat(this.x),
        y: parseFloat(this.y),
        z: parseFloat(this.z)
      });
      this.setTopicc();
      document.getElementById("publishLog").innerHTML += JSON.stringify(this.message) + "<br>";
      this.topic.publish(this.message);
    },

    changeWsAddress: function () {
      if (this.connected) {
        this.disconnect();
      }

      this.ros = new ROSLIB.Ros({
        url: this.selectedAddress
      });

      this.ros.on('connection', () => {

        this.fetchTopics();
        // console.log('Connected!');
        //this.selectedAddress = selectedAddress;

        document.getElementById("connectStatus").style.color = "green";
        document.getElementById("connectStatus").innerHTML = "Connected!";
        this.subToTopicCamera();
        this.subToTopicBattery();
        this.setupTwistTopic();

        this.connected = true;
      });

      this.ros.on('error', (error) => {
        document.getElementById("connectStatus").style.color = "red";
        document.getElementById("connectStatus").innerHTML = "Failed to connect."
        console.log('Error connecting to websocket server: ', error);
      });

      this.ros.on('close', () => {
        console.log('Connection to websocket server closed.');
        this.connected = false;
      })

      if (this.selectedAddress == null) {
        document.getElementById("connectStatus").style.color = "red";
        document.getElementById("connectStatus").innerHTML = "Choose a WS address"
        // console.log('ERROR: there is no WS address selected');
      }
    },
  }
})