import Foundation
import Vision
import ImageIO
import CoreML

// Face geometry only: no landmarks, embeddings, names or speaker inference.
// Vision coordinates originate at bottom left; the JS contract uses top left.
// https://developer.apple.com/documentation/vision/vndetectfacerectanglesrequest
struct Box: Codable { let x: Double; let y: Double; let w: Double; let h: Double; let confidence: Double }
struct Frame: Codable { let file: String; let boxes: [Box] }
struct Result: Codable { let method: String; let frames: [Frame] }
do {
    let directory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
    let urls = try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
        .filter { $0.pathExtension == "jpg" }.sorted { $0.lastPathComponent < $1.lastPathComponent }
    var frames: [Frame] = []
    for url in urls {
        let request = VNDetectFaceRectanglesRequest()
        if #available(macOS 14.0, *) {
            for (stage, devices) in try request.supportedComputeStageDevices {
                if let cpu = devices.first(where: { if case .cpu = $0 { return true }; return false }) {
                    request.setComputeDevice(cpu, for: stage)
                }
            }
        }
        let handler = VNImageRequestHandler(url: url, orientation: .up, options: [:])
        try handler.perform([request])
        let boxes = (request.results ?? []).map { face in
            let box = face.boundingBox
            return Box(x: box.minX, y: 1-box.maxY, w: box.width, h: box.height, confidence: Double(face.confidence))
        }
        frames.append(Frame(file: url.lastPathComponent, boxes: boxes))
    }
    let data = try JSONEncoder().encode(Result(method: "apple-vision-faces", frames: frames))
    FileHandle.standardOutput.write(data)
} catch {
    FileHandle.standardError.write(Data("Local Vision face detection failed: \(error.localizedDescription)\n".utf8))
    exit(1)
}
