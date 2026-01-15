/**
 * Shared Memory Writer Implementation
 *
 * TICKET_097_6: Cross-platform shared memory writer for OHLCV data.
 */

#include "shm_writer.h"
#include <cstring>
#include <chrono>
#include <algorithm>

namespace quantnexus::shm::writer {

using namespace data::shm;

// =============================================================================
// SharedMemoryWriter Implementation
// =============================================================================

SharedMemoryWriter::SharedMemoryWriter()
    : name_(""),
      size_(0),
      handle_(INVALID_HANDLE_VALUE_),
      base_ptr_(nullptr),
      region_(nullptr),
      next_data_offset_(DATA_SECTIONS_OFFSET) {
}

SharedMemoryWriter::~SharedMemoryWriter() {
    Close();
}

WriterError SharedMemoryWriter::Create(const std::string& name, size_t size) {
    if (name.empty()) {
        return WriterError::INVALID_NAME;
    }
    if (size < 4352 || size > 1024 * 1024 * 1024) {  // Min 4KB, Max 1GB
        return WriterError::INVALID_SIZE;
    }

    // Close existing region if open
    if (IsInitialized()) {
        Close();
    }

    name_ = name;
    size_ = size;

    auto err = platform_create(name, size);
    if (err != WriterError::OK) {
        return err;
    }

    // Initialize region structures
    initialize_region();

    return WriterError::OK;
}

void SharedMemoryWriter::Close() {
    platform_close();
    name_.clear();
    size_ = 0;
    region_ = nullptr;
    base_ptr_ = nullptr;
    next_data_offset_ = DATA_SECTIONS_OFFSET;
}

WriterError SharedMemoryWriter::WriteCandles(
    const std::string& symbol,
    const std::string& interval,
    const std::vector<CandleData>& candles
) {
    if (!IsInitialized()) {
        return WriterError::NOT_INITIALIZED;
    }
    if (candles.empty()) {
        return WriterError::OK;  // Nothing to write
    }
    if (candles.size() > MAX_CANDLES_PER_SYMBOL) {
        return WriterError::CANDLE_LIMIT_EXCEEDED;
    }

    begin_write();

    // Find or add symbol in index
    auto* entry = find_or_add_symbol(symbol);
    if (!entry) {
        end_write();
        return WriterError::SYMBOL_LIMIT_EXCEEDED;
    }

    // Calculate required size for data block
    size_t required_size = OHLCVDataBlock::RequiredSize(candles.size());

    // Allocate or reuse data block
    uint64_t data_offset;
    if (entry->data_offset == 0) {
        // First write for this symbol, allocate new block
        data_offset = allocate_data_block(required_size);
        if (data_offset == 0) {
            end_write();
            return WriterError::WRITE_FAILED;
        }
        entry->data_offset = data_offset;
        entry->data_size = required_size;
    } else {
        // Existing block, check if it fits
        if (required_size > entry->data_size) {
            // Need larger block, reallocate
            data_offset = allocate_data_block(required_size);
            if (data_offset == 0) {
                end_write();
                return WriterError::WRITE_FAILED;
            }
            entry->data_offset = data_offset;
            entry->data_size = required_size;
        } else {
            data_offset = entry->data_offset;
        }
    }

    // Get data block pointer
    auto* block = reinterpret_cast<OHLCVDataBlock*>(
        static_cast<uint8_t*>(base_ptr_) + data_offset
    );

    // Populate block header
    block->SetSymbol(symbol);
    block->SetInterval(interval);
    block->count = candles.size();
    block->capacity = candles.size();
    block->start_timestamp = candles.front().timestamp;
    block->end_timestamp = candles.back().timestamp;

    // Copy candles
    for (size_t i = 0; i < candles.size(); ++i) {
        const auto& src = candles[i];
        auto& dst = block->candles[i];
        dst.timestamp = src.timestamp;
        dst.open = src.open;
        dst.high = src.high;
        dst.low = src.low;
        dst.close = src.close;
        dst.volume = src.volume;
    }

    // Update symbol index entry
    entry->candle_count = candles.size();
    entry->last_update_us = GetTimestampMicros();

    end_write();

    return WriterError::OK;
}

WriterStats SharedMemoryWriter::GetStats() const {
    WriterStats stats{};
    if (!IsInitialized()) {
        return stats;
    }

    stats.total_symbols = region_->symbol_index.count;
    stats.memory_used = next_data_offset_;
    stats.last_write_us = region_->header.last_update_us;
    stats.write_count = region_->header.sequence / 2;  // Each write increments by 2

    // Count total candles
    for (uint32_t i = 0; i < region_->symbol_index.count; ++i) {
        stats.total_candles += region_->symbol_index.entries[i].candle_count;
    }

    return stats;
}

// =============================================================================
// Private Methods
// =============================================================================

void SharedMemoryWriter::initialize_region() {
    region_ = static_cast<SharedMemoryRegion*>(base_ptr_);

    // Initialize header
    region_->header.magic = MAGIC;
    region_->header.version = VERSION;
    region_->header.writer_pid = ::getpid();
    region_->header.reader_pid = 0;
    region_->header.last_update_us = GetTimestampMicros();
    region_->header.sequence = 0;  // Even number = ready
    region_->header.symbol_count = 0;
    region_->header.flags = 0;
    region_->header.crc32 = 0;

    // Initialize symbol index
    region_->symbol_index.count = 0;
    std::memset(region_->symbol_index.entries, 0, sizeof(region_->symbol_index.entries));

    next_data_offset_ = DATA_SECTIONS_OFFSET;
}

SymbolIndexEntry* SharedMemoryWriter::find_or_add_symbol(const std::string& symbol) {
    // Try to find existing entry
    auto* entry = region_->symbol_index.Find(symbol);
    if (entry) {
        return entry;
    }

    // Add new entry
    if (region_->symbol_index.count >= MAX_SYMBOLS) {
        return nullptr;
    }

    entry = region_->symbol_index.Add(symbol);
    if (entry) {
        region_->header.symbol_count = region_->symbol_index.count;
    }

    return entry;
}

uint64_t SharedMemoryWriter::allocate_data_block(size_t size) {
    // Check if we have enough space
    if (next_data_offset_ + size > size_) {
        return 0;  // Out of memory
    }

    uint64_t offset = next_data_offset_;
    next_data_offset_ += size;

    // Zero out the allocated block
    std::memset(static_cast<uint8_t*>(base_ptr_) + offset, 0, size);

    return offset;
}

void SharedMemoryWriter::begin_write() {
    // Increment sequence to odd number (write in progress)
    region_->header.sequence++;
}

void SharedMemoryWriter::end_write() {
    // Increment sequence to even number (write complete)
    region_->header.sequence++;
    region_->header.last_update_us = GetTimestampMicros();
}

// =============================================================================
// Platform-Specific Implementations
// =============================================================================

#ifdef _WIN32

WriterError SharedMemoryWriter::platform_create(const std::string& name, size_t size) {
    std::string full_name = "Local\\" + name;

    handle_ = CreateFileMappingA(
        INVALID_HANDLE_VALUE,
        nullptr,
        PAGE_READWRITE,
        static_cast<DWORD>(size >> 32),
        static_cast<DWORD>(size & 0xFFFFFFFF),
        full_name.c_str()
    );

    if (handle_ == nullptr || handle_ == INVALID_HANDLE_VALUE) {
        return WriterError::CREATE_FAILED;
    }

    base_ptr_ = MapViewOfFile(
        handle_,
        FILE_MAP_ALL_ACCESS,
        0,
        0,
        size
    );

    if (base_ptr_ == nullptr) {
        CloseHandle(handle_);
        handle_ = INVALID_HANDLE_VALUE;
        return WriterError::MAPPING_FAILED;
    }

    return WriterError::OK;
}

void SharedMemoryWriter::platform_close() {
    if (base_ptr_ != nullptr) {
        UnmapViewOfFile(base_ptr_);
        base_ptr_ = nullptr;
    }
    if (handle_ != INVALID_HANDLE_VALUE && handle_ != nullptr) {
        CloseHandle(handle_);
        handle_ = INVALID_HANDLE_VALUE;
    }
}

#else  // POSIX (Linux/macOS)

WriterError SharedMemoryWriter::platform_create(const std::string& name, size_t size) {
    std::string full_name = "/" + name;

    // Create shared memory object
    handle_ = shm_open(full_name.c_str(), O_CREAT | O_RDWR, 0666);
    if (handle_ == -1) {
        return WriterError::CREATE_FAILED;
    }

    // Set size
    if (ftruncate(handle_, size) == -1) {
        ::close(handle_);
        shm_unlink(full_name.c_str());
        handle_ = -1;
        return WriterError::CREATE_FAILED;
    }

    // Map into memory
    base_ptr_ = mmap(
        nullptr,
        size,
        PROT_READ | PROT_WRITE,
        MAP_SHARED,
        handle_,
        0
    );

    if (base_ptr_ == MAP_FAILED) {
        ::close(handle_);
        shm_unlink(full_name.c_str());
        handle_ = -1;
        base_ptr_ = nullptr;
        return WriterError::MAPPING_FAILED;
    }

    return WriterError::OK;
}

void SharedMemoryWriter::platform_close() {
    if (base_ptr_ != nullptr && base_ptr_ != MAP_FAILED) {
        munmap(base_ptr_, size_);
        base_ptr_ = nullptr;
    }
    if (handle_ != -1) {
        ::close(handle_);
        handle_ = -1;
    }
    // Note: We don't unlink the shm object here, let the reader clean up
}

#endif

// =============================================================================
// N-API Wrapper Implementation
// =============================================================================

Napi::FunctionReference SharedMemoryWriterWrapper::constructor;

SharedMemoryWriterWrapper::SharedMemoryWriterWrapper(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<SharedMemoryWriterWrapper>(info) {
    writer_ = std::make_unique<SharedMemoryWriter>();
}

Napi::Object SharedMemoryWriterWrapper::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "SharedMemoryWriter", {
        InstanceMethod("create", &SharedMemoryWriterWrapper::Create),
        InstanceMethod("close", &SharedMemoryWriterWrapper::Close),
        InstanceMethod("writeCandles", &SharedMemoryWriterWrapper::WriteCandles),
        InstanceMethod("getStats", &SharedMemoryWriterWrapper::GetStats),
        InstanceMethod("isInitialized", &SharedMemoryWriterWrapper::IsInitialized),
    });

    constructor = Napi::Persistent(func);
    constructor.SuppressDestruct();

    exports.Set("SharedMemoryWriter", func);
    return exports;
}

Napi::Value SharedMemoryWriterWrapper::Create(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "String expected for name").ThrowAsJavaScriptException();
        return env.Undefined();
    }

    std::string name = info[0].As<Napi::String>().Utf8Value();
    size_t size = REGION_SIZE;

    if (info.Length() >= 2 && info[1].IsNumber()) {
        size = info[1].As<Napi::Number>().Uint32Value();
    }

    auto err = writer_->Create(name, size);
    if (err != WriterError::OK) {
        std::string msg = "Failed to create shared memory: error code " + std::to_string(static_cast<int>(err));
        Napi::Error::New(env, msg).ThrowAsJavaScriptException();
        return env.Undefined();
    }

    return Napi::Boolean::New(env, true);
}

Napi::Value SharedMemoryWriterWrapper::Close(const Napi::CallbackInfo& info) {
    writer_->Close();
    return info.Env().Undefined();
}

Napi::Value SharedMemoryWriterWrapper::WriteCandles(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 3 ||
        !info[0].IsString() ||
        !info[1].IsString() ||
        !info[2].IsArray()) {
        Napi::TypeError::New(env, "Expected: (symbol: string, interval: string, candles: Array)")
            .ThrowAsJavaScriptException();
        return env.Undefined();
    }

    std::string symbol = info[0].As<Napi::String>().Utf8Value();
    std::string interval = info[1].As<Napi::String>().Utf8Value();
    Napi::Array js_candles = info[2].As<Napi::Array>();

    // Convert JavaScript array to C++ vector
    std::vector<CandleData> candles;
    candles.reserve(js_candles.Length());

    for (uint32_t i = 0; i < js_candles.Length(); ++i) {
        Napi::Value item = js_candles[i];
        if (!item.IsObject()) {
            continue;
        }

        Napi::Object obj = item.As<Napi::Object>();
        CandleData candle;

        candle.timestamp = obj.Get("timestamp").As<Napi::Number>().Int64Value();
        candle.open = obj.Get("open").As<Napi::Number>().DoubleValue();
        candle.high = obj.Get("high").As<Napi::Number>().DoubleValue();
        candle.low = obj.Get("low").As<Napi::Number>().DoubleValue();
        candle.close = obj.Get("close").As<Napi::Number>().DoubleValue();
        candle.volume = obj.Get("volume").As<Napi::Number>().DoubleValue();

        candles.push_back(candle);
    }

    auto err = writer_->WriteCandles(symbol, interval, candles);
    if (err != WriterError::OK) {
        std::string msg = "Failed to write candles: error code " + std::to_string(static_cast<int>(err));
        Napi::Error::New(env, msg).ThrowAsJavaScriptException();
        return env.Undefined();
    }

    return Napi::Boolean::New(env, true);
}

Napi::Value SharedMemoryWriterWrapper::GetStats(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    auto stats = writer_->GetStats();

    Napi::Object obj = Napi::Object::New(env);
    obj.Set("totalSymbols", Napi::Number::New(env, stats.total_symbols));
    obj.Set("totalCandles", Napi::Number::New(env, stats.total_candles));
    obj.Set("memoryUsed", Napi::Number::New(env, stats.memory_used));
    obj.Set("lastWriteUs", Napi::Number::New(env, stats.last_write_us));
    obj.Set("writeCount", Napi::Number::New(env, stats.write_count));

    return obj;
}

Napi::Value SharedMemoryWriterWrapper::IsInitialized(const Napi::CallbackInfo& info) {
    return Napi::Boolean::New(info.Env(), writer_->IsInitialized());
}

} // namespace quantnexus::shm::writer
