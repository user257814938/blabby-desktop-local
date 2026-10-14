$ErrorActionPreference='Stop'
[Console]::InputEncoding=[Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
Add-Type -ReferencedAssemblies System.Speech,System.Web.Extensions -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Speech.Recognition;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
public static class BlabbyWindowsSpeech {
 static readonly object Gate=new object();
 static readonly JavaScriptSerializer Json=new JavaScriptSerializer();
 static SpeechRecognitionEngine Engine;
 static StringBuilder Text=new StringBuilder();
 static AutoResetEvent Done=new AutoResetEvent(false);
 static Stopwatch Clock=new Stopwatch();
 static string Culture;
 static bool Running=false;
 static void Emit(object value){lock(Gate){Console.WriteLine(Json.Serialize(value));Console.Out.Flush();}}
 static void Prepare(string culture){
  if(Engine!=null && Culture==culture)return;
  if(Engine!=null)Engine.Dispose();
  Engine=new SpeechRecognitionEngine(new CultureInfo(culture));
  Engine.LoadGrammar(new DictationGrammar());Culture=culture;
  Engine.SpeechHypothesized+=(s,e)=>{lock(Gate){Emit(new {partial=true,text=Text.ToString()+e.Result.Text});}};
  Engine.SpeechRecognized+=(s,e)=>{lock(Gate){Text.Append(e.Result.Text).Append(" ");Emit(new {partial=true,text=Text.ToString().TrimEnd()});}};
  Engine.AudioLevelUpdated+=(s,e)=>Emit(new {level=e.AudioLevel/100.0});
  Engine.RecognizeCompleted+=(s,e)=>Done.Set();
 }
 public static void Run(){
  try{
   var infos=SpeechRecognitionEngine.InstalledRecognizers();
   var cultures=new List<string>();foreach(var info in infos)cultures.Add(info.Culture.Name);
   if(cultures.Count==0)throw new Exception("Aucun moteur Windows local installé.");
   Prepare(cultures.Contains("fr-FR")?"fr-FR":cultures[0]);
   Emit(new {ready=true,cultures=cultures});
   string line;
   while((line=Console.ReadLine())!=null){
    Dictionary<string,object> request=null;object id=null;
    try{
     request=Json.Deserialize<Dictionary<string,object>>(line);id=request["id"];
     string action=(string)request["action"];
     if(action=="start"){
      if(Running)throw new Exception("Enregistrement déjà en cours.");
      string culture=request.ContainsKey("culture")?(string)request["culture"]:Culture;
      Prepare(culture);lock(Gate){Text.Clear();}Done.Reset();
      if(request.ContainsKey("testAudio") && request["testAudio"]!=null)Engine.SetInputToWaveFile((string)request["testAudio"]);
      else Engine.SetInputToDefaultAudioDevice();
      Clock.Restart();Running=true;Engine.RecognizeAsync(RecognizeMode.Multiple);
      Emit(new {id=id,started=true});
     }else if(action=="stop"){
      double duration=Clock.Elapsed.TotalSeconds;var timer=Stopwatch.StartNew();
      if(Running){Engine.RecognizeAsyncStop();if(!Done.WaitOne(5000)){Engine.RecognizeAsyncCancel();Done.WaitOne(1000);}Running=false;Engine.SetInputToNull();}
      string text;lock(Gate){text=Text.ToString().Trim();}
      Emit(new {id=id,text=text,language=Culture.Substring(0,2),duration=duration,elapsed=timer.Elapsed.TotalSeconds,model="windows-local"});
     }else throw new Exception("Action inconnue.");
    }catch(Exception error){Running=false;try{Engine.RecognizeAsyncCancel();Engine.SetInputToNull();}catch{}Emit(new {id=id,error=error.Message});}
   }
  }catch(Exception error){Emit(new {error=error.Message});}
  finally{if(Engine!=null)Engine.Dispose();}
 }
}
'@
[BlabbyWindowsSpeech]::Run()
