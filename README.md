# Zeroth-Wrapper

This API offers a speech-to-text service for english and korean audio. You send an audio file and our service returns 
the transcribed text.

## Overview

This API uses deep neural networks to convert spoken language to text. 
The audio clip's waveform is analyzed according to its spectral density, and this information is sliced into very 
short time segments. A time delay neural network (TDNN) maps this audio information to a series of distinct sounds, 
or phones. A recurrent language model (RNN-LM), trained on millions of lines of text, then predicts the most probable 
sequence of words that the phone sequence represents.

## Endpoint

Accepts a single file with mimetype `audio/*` and a size up to 500kb and returns the transcribed text as json. 

Url: `/speech-to-text`

Method: `POST`

Returns: `200` with payload `{"transcript":"WELCOME TO THE LANGUAGE NETWORK."}`

## Simple Example

``` html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <script src="https://code.jquery.com/jquery-3.3.1.min.js"></script>
</head>
<body>
<div>
    <input name="fileBox" id="fileBox" type="file" size="50" accept=".mp3, .flac, .wav">
    <button id="MyButton">Upload</button>
</div>
<script>
  $(document).ready(function () {
    $('#MyButton').click(function () {
      postAudio();
    });
  });

  function postAudio() {
    var box = document.getElementById("fileBox");
    var formData = new FormData();
    formData.append('file', box.files[0]);

    $.ajax({
      url: 'http://localhost:3000/speech-to-text',
      crossDomain: true,
      type: 'POST',
      data: formData,
      processData: false,
      contentType: false,
      success: function (data) {
        console.log(data);
      },
      error: function (error) {
        console.log(error);
      }
    });
  };
</script>
</body>
</html>
```