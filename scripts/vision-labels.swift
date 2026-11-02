import Foundation
import Vision

// What is visible in each frame, from Apple Vision's on-device image classifier (free, no network).
// Usage: swift vision-labels.swift <directory of .jpg frames>; prints JSON {frames:[{file,labels:[{id,c}]}]}.
struct Label: Codable { let id: String; let c: Double }
struct Frame: Codable { let file: String; let labels: [Label] }
struct Result: Codable { let method: String; let frames: [Frame] }
do {
    let directory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
    let urls = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
        .filter { $0.pathExtension == "jpg" }.sorted { $0.lastPathComponent < $1.lastPathComponent }
    var frames: [Frame] = []
    for url in urls {
        let request = VNClassifyImageRequest()
        try VNImageRequestHandler(url: url, options: [:]).perform([request])
        let labels = (request.results ?? []).filter { $0.confidence >= 0.3 }.prefix(8).map { Label(id: $0.identifier, c: (Double($0.confidence) * 100).rounded() / 100) }
        frames.append(Frame(file: url.lastPathComponent, labels: Array(labels)))
    }
    FileHandle.standardOutput.write(try JSONEncoder().encode(Result(method: "apple-vision-classify", frames: frames)))
} catch {
    FileHandle.standardError.write(Data("Vision classification failed: \(error.localizedDescription)\n".utf8))
    exit(1)
}
