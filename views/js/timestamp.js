var date = new Date();
var split = ("" + date).split(" ");
exports.timestamp = split[0] + ", " + split[2] + "-" + split[1] + "-" + split[3] +
                    " @ " + split[4] + " (" + split[5] + ")";